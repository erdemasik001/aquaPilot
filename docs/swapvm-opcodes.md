# SwapVM Opcode & Encoding Envanteri

> **dev1 · Gün 1 teslimi.** Bu belgedeki her satır `1inch/swap-vm` kaynağından doğrulanmıştır. Tahmin yoktur; doğrulanmamış olanlar açıkça _[DOĞRULANMADI]_ diye işaretlidir.
>
> Referans checkout: `D:\projeler\_reference\swap-vm` (`--depth 1`, Solidity 0.8.30)

---

## 1. Program encoding — kesinleşmiş

Program, art arda dizilmiş instruction'lardan oluşan düz bir byte dizisidir. Instruction başına layout:

```
┌────────────┬──────────────┬────────────────────┐
│ opcode     │ argsLength   │ args               │
│ 1 byte     │ 1 byte       │ argsLength byte    │
└────────────┴──────────────┴────────────────────┘
```

**Encoder tarafı** — `test/utils/ProgramBuilder.sol`:

```solidity
function build(Program, Opcode opcode, bytes memory args) internal pure returns (bytes memory) {
    return abi.encodePacked(opcode, args.length.toUint8(), args);
}
```

**Decoder tarafı** — `src/libs/VM.sol` → `ContextLib.runLoop()`:

```solidity
let word := calldataload(add(programBytes.offset, pcs))
opcode     := shr(248, word)                 // ilk byte
argsLength := and(shr(240, word), 0xff)      // ikinci byte
pcs := add(pcs, 2)
args.offset := add(programBytes.offset, pcs)
args.length := argsLength
pcs := add(pcs, argsLength)
```

### Bundan çıkan sert sınırlar

| Sınır                                  | Değer                                         | Kaynak                                            |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| Instruction başına argüman             | **≤ 255 byte**                                | `argsLength` tek byte; `toUint8()` taşarsa revert |
| Program uzunluğu (jump adreslenebilir) | **≤ 65.535 byte**                             | jump hedefleri `uint16`; `VM.sol` runLoop yorumu  |
| PC taşması                             | `pcs > length` → `RunLoopExceedProgramLength` | `VM.sol:143`                                      |

> `Extruction` (`0x04`) keyfi `uint256 nextPC` desteklediği için 64KB üstü programlarda tek kaçış yolu odur.

---

## 2. Opcode setleri ve router matrisi — **mimari kararı belirleyen bulgu**

Üç ayrı opcode seti var. Hangi router'ı deploy ettiğiniz, hangi instruction'ların **var olduğunu** belirliyor. Dispatch edilmeyen opcode `UnknownOpcode(opcode)` ile revert eder.

| Opcode seti    | Router              | Instruction aileleri                                                                                                                                                                                                      |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Opcodes`      | **`SwapVMRouter`**  | **Hepsi** — Controls, Balances, Invalidators, LimitSwap, XYC, XYCConcentrate, Pegged, Decay, MinRate, DutchAuction, BaseFeeAdjuster, TWAP, Fee, FeeExperimental, SeriesEpoch, Whitelist, PiecewiseLinearScale, Extruction |
| `LimitOpcodes` | `LimitSwapVMRouter` | Controls, Balances, Invalidators, LimitSwap, BaseFeeAdjuster, Fee, SeriesEpoch, Whitelist, PiecewiseLinearScale, Extruction — **DutchAuction / MinRate / TWAP / XYC / Decay yok**                                         |
| `AquaOpcodes`  | `AquaSwapVMRouter`  | Controls, XYC, XYCConcentrate, Decay, Pegged, Fee, Extruction — **LimitSwap / StaticBalances / Invalidators / DutchAuction / TWAP yok**                                                                                   |

### ⚠️ Aqua bir opcode seti değil, bir trait bayrağıdır

Bu, projenin en kritik mimari bulgusu. `src/libs/MakerTraits.sol`:

```solidity
uint256 constant internal USE_AQUA_INSTEAD_OF_SIGNATURE_BIT_FLAG = 1 << 254;
```

`useAquaInsteadOfSignature` order'ın **traits** alanındaki bir bittir — opcode setinden bağımsızdır. `PROGRAMS.md §3` bunu doğruluyor: _"`useAquaInsteadOfSignature` settlement/auth akışını değiştirir, VM strateji kompozisyonunu değil."_

Ayrıca her üç router da constructor'ında `aqua` adresi alır:

```solidity
contract SwapVMRouter is Simulator, SwapVM, Opcodes {
    constructor(address aqua, address weth, address owner, string memory name, string memory version)
        SwapVM(aqua, weth, owner, name, version) Opcodes(aqua) { }
}
```

**→ Karar: `SwapVMRouter` + `useAquaInsteadOfSignature = true`.**
Böylece tam opcode setine (LimitSwap, StaticBalances, Invalidators, DutchAuction, TWAP, branching) **ve** Aqua-destekli bakiye/settlement'a aynı anda sahip oluruz. `AquaSwapVMRouter` kullansaydık limit-order merdiveni kurmak **imkânsızdı** — `LimitSwap` ve `StaticBalances` orada dispatch edilmiyor.

### `OraclePriceAdjuster` kullanılamaz durumda

`src/instructions/OraclePriceAdjuster.sol` mevcut ve `_oraclePriceAdjuster1D` implement edilmiş, README mimari şemasında da geçiyor — **ama `Opcode` enum'unda karşılığı yok ve üç opcode setinin hiçbirinde dispatch edilmiyor.** Kullanmak için kendi router + opcode setimizi yazmamız gerekir; bu da "custom opcode yazma" kategorisine girer ve plan gereği kapsam dışı.

**Sonuç: plandaki "oracle-ayarlı merdiven" fikri düşürüldü.** Yerine dallanmalı (`JumpIfTokenIn`) + `DutchAuction` / `BaseFeeAdjuster` ile dinamik fiyatlama gidilecek — bunların hepsi `Opcodes` setinde gerçekten var. Bkz. [aquapilot-plan.md](aquapilot-plan.md) §5.

---

## 3. Opcode tablosu (`src/libs/OpcodeList.sol`)

Enum sırası = opcode numarası. Aileler bank'lara bölünmüş; `0xf0-0xff` rezerve (2-byte opcode escape prefix ihtimali için) ve **asla tahsis edilmiyor**.

| Bank        | Aile                               | Tahsisli opcode'lar                                                                                                                                                                                                                                                                                   |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x00-0x0f` | Core control flow                  | `00` Stop · `01` Revert · `02` Salt · `03` Jump · `04` Extruction                                                                                                                                                                                                                                     |
| `0x10-0x1f` | Debug (yalnız `*Debug` setlerinde) | `10` PrintSwapRegisters · `11` PrintSwapQuery · `12` PrintContext · `13` PrintFreeMemoryPointer · `14` PrintGasLeft · `1a` PatchSwapRegisters                                                                                                                                                         |
| `0x20-0x3f` | Koşullar & erişim                  | `20` Deadline · `23` OnlyTakerTokenBalanceNonZero · `24` OnlyTakerTokenBalanceGte · `25` OnlyTakerTokenSupplyShareGte · `26` OnlyTxOriginTokenBalanceNonZero · `2b` PrivateOrder · `2c` WhitelistCoequal · `2d` WhitelistSequential · `30` JumpIfDirection · `31` JumpIfTokenIn · `32` JumpIfTokenOut |
| `0x40-0x4f` | Invalidator & epoch                | `40` InvalidateBit · `41` InvalidateTokenIn · `42` InvalidateTokenOut · `48` ValidateSeriesEpoch                                                                                                                                                                                                      |
| `0x50-0x6f` | Swap eğrileri                      | `50` XYCSwap · `51` XYCConcentrateSwap · `53` LimitSwap · `54` LimitSwapFullAmount · `58` PeggedSwap                                                                                                                                                                                                  |
| `0x70-0x8f` | Ücretler                           | `70` FlatFeeAmountIn · `71` ProtocolFeeAmountIn · `72` AquaProtocolFeeAmountIn · `73` ProgressiveFeeIn · `74` DynamicProtocolFeeAmountIn · `75` AquaDynamicProtocolFeeAmountIn · `80` FlatFeeAmountOut · `81` ProtocolFeeAmountOut · `82` AquaProtocolFeeAmountOut · `83` ProgressiveFeeOut           |
| `0x90-0xaf` | Bakiye ayarı                       | `90` StaticBalances · `91` DynamicBalances · `94` DutchAuctionBalanceIn · `95` DutchAuctionBalanceOut · `98` PiecewiseLinearScaleBalanceIn · `99` PiecewiseLinearScaleBalanceOut · `9c` Decay · `9d` TWAPSwap                                                                                         |
| `0xb0-0xcf` | Oran ayarı                         | `b0` RequireMinRate · `b1` AdjustMinRate · `b4` BaseFeeAdjuster                                                                                                                                                                                                                                       |
| `0xd0-0xef` | Tahsissiz                          | —                                                                                                                                                                                                                                                                                                     |
| `0xf0-0xff` | **Rezerve**                        | asla kullanma                                                                                                                                                                                                                                                                                         |

---

## 4. Argüman layout'ları (TS port'unun sözleşmesi)

Tümü `abi.encodePacked` — **padding yok**, alanlar bitişik. Aşağıdakiler ilgili `*ArgsBuilder` kütüphanelerinden ve instruction `parse` kodlarından birebir çıkarılmıştır.

### Controls (`src/instructions/Controls.sol`)

| Opcode                               | Args                                   | Uzunluk  | Not                                                      |
| ------------------------------------ | -------------------------------------- | -------- | -------------------------------------------------------- |
| `00` Stop                            | —                                      | 0        | `nextPC = type(uint256).max`                             |
| `01` Revert                          | `bytes reason`                         | değişken | `InstructionRevert(bytes)` ile revert                    |
| `02` Salt                            | `uint64` veya keyfi `bytes`            | değişken | **No-op.** Yalnızca orderHash'i benzersizleştirir        |
| `03` Jump                            | `uint16 nextPC`                        | 2        | Koşulsuz                                                 |
| `20` Deadline                        | `uint40 deadline`                      | **5**    | `block.timestamp <= deadline`                            |
| `23` OnlyTakerTokenBalanceNonZero    | `address token`                        | 20       | ERC-20 **ve** NFT                                        |
| `24` OnlyTakerTokenBalanceGte        | `address token` + `uint256 minAmount`  | 52       |                                                          |
| `25` OnlyTakerTokenSupplyShareGte    | `address token` + `uint64 minShareE18` | 28       |                                                          |
| `26` OnlyTxOriginTokenBalanceNonZero | `address token`                        | 20       | ⚠️ `tx.origin` doğrulaması zayıf sayılır (kaynak yorumu) |
| `30` JumpIfDirection                 | `bool expected` + `uint16 nextPC`      | 3        |                                                          |
| `31` JumpIfTokenIn                   | `address token` + `uint16 nextPC`      | **22**   |                                                          |
| `32` JumpIfTokenOut                  | `address token` + `uint16 nextPC`      | **22**   |                                                          |

### Balances (`src/instructions/Balances.sol`)

| Opcode               | Args                                    | Uzunluk |
| -------------------- | --------------------------------------- | ------- |
| `90` StaticBalances  | `uint256 balanceA` + `uint256 balanceB` | **64**  |
| `91` DynamicBalances | `uint256 balanceA` + `uint256 balanceB` | **64**  |

> **Tuzak:** argümanlar `(in, out)` değil **sıralı token düzeninde `(A, B)`** verilir. Instruction, `tokenIn < tokenOut` karşılaştırmasına göre kendisi eşler:
>
> ```solidity
> if (ctx.query.tokenIn < ctx.query.tokenOut) (balanceIn, balanceOut) = parse(args);
> else                                        (balanceOut, balanceIn) = parse(args);
> ```
>
> TS port'unda bunu ters kurmak, sessizce ters fiyatlı bir program üretir. Golden fixture testinin yakalaması gereken ilk hata budur.

### LimitSwap (`src/instructions/LimitSwap.sol`)

| Opcode                   | Args                                             | Uzunluk |
| ------------------------ | ------------------------------------------------ | ------- |
| `53` LimitSwap           | `bool makerDirectionLt` (= `tokenIn < tokenOut`) | **1**   |
| `54` LimitSwapFullAmount | `bool makerDirectionLt`                          | **1**   |

Fiyatlama sabit oranlıdır, bakiye oranından türetilir:

- exactIn → `amountOut = amountIn * balanceOut / balanceIn` (floor, kasıtlı)
- exactOut → `amountIn = ceilDiv(amountOut * balanceIn, balanceOut)` (ceil, kasıtlı)

### Invalidators (`src/instructions/Invalidators.sol`)

| Opcode                  | Args              | Uzunluk | Kullanım                             |
| ----------------------- | ----------------- | ------- | ------------------------------------ |
| `40` InvalidateBit      | `uint32 bitIndex` | **4**   | Tek seferlik order (replay koruması) |
| `41` InvalidateTokenIn  | —                 | 0       | Kısmi doldurma, girdi tarafı sayacı  |
| `42` InvalidateTokenOut | —                 | 0       | Kısmi doldurma, çıktı tarafı sayacı  |

_[DOĞRULANMADI]_ — Fee, XYC, Decay, DutchAuction, TWAP, BaseFeeAdjuster, MinRate, PiecewiseLinearScale, Whitelist, SeriesEpoch, Extruction argüman layout'ları henüz çıkarılmadı. Strateji tasarımı kesinleştiğinde yalnızca kullanılacak olanlar eklenecek.

---

## 5. Sıralama kuralları — validator'ın kural tabanı

Hepsi kaynaktaki `require`/`revert` ifadelerinden türetildi. **Bunlar validator'ın Gün 4'te uygulayacağı kurallardır.**

| #   | Kural                                                                                                                     | İhlal edilirse                                   | Kaynak                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| R1  | `StaticBalances`/`DynamicBalances` **program başında ve tam bir kez**; çalıştığında `balanceIn == balanceOut == 0` olmalı | `SetBalancesExpectZeroBalances`                  | `Balances.sol:38,57`                                          |
| R2  | `LimitSwap` **bakiyelerden sonra** gelmeli                                                                                | `LimitSwapRequiresBothBalancesNonZero`           | `LimitSwap.sol:41`                                            |
| R3  | Bir yürütme yolunda **tek swap** instruction'ı                                                                            | `LimitSwapRecomputeDetected`                     | `LimitSwap.sol:48,51`                                         |
| R4  | `LimitSwap` argümanındaki yön, gerçek swap yönüyle eşleşmeli                                                              | `LimitSwapDirectionMismatch`                     | `LimitSwap.sol:45`                                            |
| R5  | `MakerTraits.build` çağrısında **`tokenA < tokenB` sıralı** olmalı                                                        | `MakerTraitsTokensNotSorted`                     | `MakerTraits.sol:103`                                         |
| R6  | Jump hedefi bir instruction sınırına düşmeli ve `< 65.536` olmalı                                                         | `RunLoopExceedProgramLength` / sessiz bozulma    | `VM.sol:143`                                                  |
| R7  | Instruction argümanı **≤ 255 byte**                                                                                       | `toUint8()` taşması                              | `ProgramBuilder.sol:22`                                       |
| R8  | **Geriye jump yasak** → `DynamicBalances`, `InvalidateBit`, `InvalidateTokenIn/Out`                                       | quote/swap tutarsızlığı — sessiz, en tehlikelisi | `Balances.sol:51-54`, `Invalidators.sol:80-83,97-100,118-121` |
| R9  | `OraclePriceAdjuster` swap'tan **sonra** gelmeli                                                                          | `OraclePriceAdjusterShouldBeAppliedAfterSwap`    | `OraclePriceAdjuster.sol:83` _(şu an dispatch edilmiyor)_     |
| R10 | Ücret instruction'ı yerleşimi ekonomik sonucu değiştirir                                                                  | sessiz — yalnızca invariant testiyle yakalanır   | `PROGRAMS.md:34,116`                                          |

### Sarmalayan (wrapping) instruction'lar — VM'in en ince semantiği

Üç instruction, `ctx.runLoop()` çağırarak **programın geri kalanını iç içe çalıştırır**, sonra son-işlem uygular:

- `_dynamicBalancesXD` — iç döngüyü çalıştırır, sonra saklı bakiyeleri `amountIn`/`amountOut` ile günceller
- `_invalidateTokenIn1D` — `amountIn` hesaplanmamışsa önce iç döngüyü çalıştırır, sonra kümülatif doldurmayı kontrol eder
- `_invalidateTokenOut1D` — aynısı `amountOut` için

Yani bu instruction'lar düz bir dizide "sonra gelen" değil, **sonrasını kapsayan** öğelerdir. TS builder'ın program modeli bunu temsil edebilmeli; aksi halde kısmi doldurma sayacı yanlış konumlanır. R8'in sebebi de budur.

---

## 6. Order zarfı (program bytecode'un dışı)

Program tek başına yeterli değil; `ISwapVM.Order` içine paketlenir — `MakerTraits.sol:102-163`.

```
Order {
  maker  : address
  traits : uint256   // bit bayrakları + slice indeksleri + receiver
  data   : bytes     // tokenA ‖ tokenB ‖ [hook'lar] ‖ program
}
```

**traits bit haritası:**

| Bit       | Anlam                                          |
| --------- | ---------------------------------------------- |
| `255`     | `shouldUnwrapWeth`                             |
| `254`     | **`useAquaInsteadOfSignature`** ← Aqua modu    |
| `253`     | `allowZeroAmountIn`                            |
| `252-249` | pre/post transfer-in/out hook var mı           |
| `248-245` | ilgili hook'un ayrı target adresi var mı       |
| `224-160` | `orderDataIndexes` — 4 × `uint16` slice ofseti |
| `159-0`   | `receiver` (sıfırsa maker)                     |

`data` içinde program **son slice**'tır; ofsetler `40 + hook uzunlukları` üzerinden hesaplanır. TS port'u yalnızca programı değil, **bu zarfı da** üretmeli.

---

## 7. TS port'u için çıkarılan görev listesi (Gün 2)

1. `Opcode` enum'unu sabit tablo olarak yansıt (yalnızca tahsisli olanlar; `0xf0+` yasak).
2. `encodeInstruction(opcode, args)` → `[op, len, ...args]`, `len > 255` ise fırlat.
3. Tip başına packed encoder: `uint8/16/32/40/64/256`, `address`, `bool` — hepsi sol-dolgusuz, tam genişlikte.
4. Opcode başına tipli `args` builder (yukarıdaki §4 tablosu).
5. `buildOrder(...)` → traits bit paketleme + slice indeksleri + `data` birleştirme.
6. **Golden fixture testi:** Foundry'nin gerçek `ProgramBuilder`/`MakerTraitsLib` çıktısına karşı byte-byte eşitlik. Bu, GATE 2'dir.

---

## 8. Kaynak referansları

| Konu                     | Dosya                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| Program decode / runLoop | `src/libs/VM.sol`                                                   |
| Referans encoder         | `test/utils/ProgramBuilder.sol`                                     |
| Opcode enum              | `src/libs/OpcodeList.sol`                                           |
| Opcode setleri           | `src/opcodes/{Opcodes,LimitOpcodes,AquaOpcodes}.sol`                |
| Router'lar               | `src/routers/{SwapVMRouter,LimitSwapVMRouter,AquaSwapVMRouter}.sol` |
| Order zarfı & traits     | `src/libs/MakerTraits.sol`                                          |
| Instruction'lar          | `src/instructions/*.sol`                                            |
| Program kataloğu         | `docs/PROGRAMS.md`                                                  |
