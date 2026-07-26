# Fork Ortamı ve Deployment

> **dev2 · Gün 1 referansı.** Aşağıdaki bulgu Gün 1'de kaynak denetiminden çıktı ve fork stratejisini değiştirdi.

---

## 1. Bulgu: Aqua ve SwapVM'in yayınlanmış mainnet adresi yok

Fork planı başlangıçta "mainnet'i forkla, deploy edilmiş Aqua/SwapVM adreslerine bağlan" varsayımına dayanıyordu. **Bu varsayım yanlış.** Kaynak denetimi:

| Kanıt                                      | İçerik                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `swap-vm/config/constants.json`            | Yalnızca chain `31337`; `aqua` = `0x0000…0000`                                                                  |
| `swap-vm/ignition/parameters/chain-1.json` | `aqua` = `0x0000…0000`, `owner` = `0x0000…0000`; yalnızca `weth` gerçek                                         |
| `swap-vm/ignition/deployments/`            | **Klasör mevcut değil** — `DEPLOY.md` gerçek-ağ deployment'larının commit'lendiğini söylüyor, commit'lenmiş yok |
| `aqua/config/constants.json`               | Yalnızca `owner` → chain `1` → `0x0000…0000`                                                                    |
| `aqua/DEPLOY.md`                           | Kanonik adres tablosu yok; `make deploy-aqua-router` ile kendin deploy ediyorsun                                |

Bu, Aqua'nın hâlâ geliştirici erişiminde olmasıyla ve halka açık frontend'inin bulunmamasıyla tutarlı.

### Sonuç

Fork ortamı şu hale geliyor:

```
mainnet fork  ─┬─▶ gerçek token'lar (WETH, USDC) ve gerçek likidite  ← fork'tan gelir
               ├─▶ AquaRouter                                        ← BİZ deploy ederiz
               └─▶ SwapVMRouter(aqua, weth, owner, name, version)    ← BİZ deploy ederiz
```

Mainnet'i forklamaya yine de değer: gerçek token kontratları, gerçek decimals, gerçek balance slot'ları ve whale hesaplarından impersonation ile fonlama. Yalnızca protokol katmanını biz kuruyoruz.

### Submission açısından

1inch şartı "resmi Aqua/SwapVM kontratları" ve local fork **açıkça kabul edilmiş** durumda. Biz resmi kaynağı **değiştirmeden**, pinlenmiş submodule commit'inden deploy ediyoruz. Submission'da bunu tam olarak böyle ifade edeceğiz — "deploy edilmiş mainnet adreslerine bağlandık" **demeyeceğiz**, çünkü öyle bir adres yok.

---

## 2. Pinlenmiş kaynaklar

Referans kontratlar submodule olarak eklidir; **hiçbir 1inch kodu repoya kopyalanmaz.**

| Submodule       | Yol                     | Pin                             |
| --------------- | ----------------------- | ------------------------------- |
| `1inch/swap-vm` | `contracts/lib/swap-vm` | `fcca73f` (v1.0.1-177-gfcca73f) |
| `1inch/aqua`    | `contracts/lib/aqua`    | `7a5972a` (v1.0.0-1-g7a5972a)   |

Klonladıktan sonra:

```bash
git submodule update --init --recursive
```

Her iki repo da bağımlılıklarını `node_modules` üzerinden remap ediyor (`forge-std`, `@openzeppelin/contracts`, `@1inch/solidity-utils`, `@1inch/aqua`), yani submodule içinde kendi paket kurulumları çalıştırılmalıdır.

---

## 3. Fork ayağa kaldırma sırası

```
1. anvil --fork-url $MAINNET_RPC_URL --fork-block-number <pinned>
2. AquaRouter deploy et                    → AQUA_ADDRESS
3. SwapVMRouter deploy et                  → aqua = AQUA_ADDRESS
                                             weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
                                             owner, name = "SwapVMRouter", version = "1.2.0"
4. Maker ve taker hesaplarını fonla        → whale impersonation + setBalance
5. Maker'dan router'a ERC-20 approve
6. Adresleri deployments/local.json'a yaz  → execution ve web paketleri bunu okur
```

**Fork bloğu pinlenmeli.** Sabit blok numarası olmadan whale bakiyeleri ve token state'i değişir, demo tekrarlanabilir olmaz — Gün 5'te sahnede en çok canı yakacak şey budur.

`SwapVMRouter` seçimi bilinçlidir: `AquaSwapVMRouter`, `LimitSwap` / `StaticBalances` / invalidator'ları dispatch etmediği için merdiven stratejisi orada kurulamaz. Aqua-destekli settlement `useAquaInsteadOfSignature` maker trait'i ile açılır. Gerekçe: [swapvm-opcodes.md](swapvm-opcodes.md) §2.

---

## 4. Sabitler

| Ad                  | Değer                                        | Kaynak                                     |
| ------------------- | -------------------------------------------- | ------------------------------------------ |
| WETH (mainnet)      | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `swap-vm/ignition/parameters/chain-1.json` |
| SwapVMRouter adı    | `SwapVMRouter`                               | aynı dosya                                 |
| SwapVMRouter sürümü | `1.2.0`                                      | aynı dosya                                 |
| Yerel chain id      | `31337`                                      | anvil varsayılanı                          |

_[DOĞRULANMADI]_ — Demo çiftinin ikinci token'ı (USDC vb.) ve fonlama için kullanılacak whale adresleri henüz seçilmedi. Token sırası `tokenA < tokenB` olmak zorunda (`MakerTraitsTokensNotSorted`).
