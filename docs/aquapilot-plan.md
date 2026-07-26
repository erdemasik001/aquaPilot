# AquaPilot — Proje Planı

**Tek cümle:** 1inch SwapVM komut seti için ilk strateji composer'ı — doğal dille parametrelenen, doğrulanan ve forklanmış mainnet'te gerçekten dolan çok bacaklı SwapVM programları.

**Durum:** Plan (v1)
**Ekip:** 3 developer (dev1 / dev2 / dev3)
**Süre:** 5 gün
**Hedef track:** 1inch — Build an Aqua App ($5.000 · 1. $2.500 / 2. $1.500 / 3. $1.000)
**Opsiyonel track:** The Graph — Best AI Use Case ($3.000) — *sadece koşul sağlanırsa, bkz. §8*

---

## 1. Neden bu proje

Doğrulanmış boşluk:

- 1inch'in **kendi doğal-dil SwapVM composer'ı yok.**
- **Halka açık Aqua frontend'i yok** (2026'da geleceği duyuruldu).
- Kayıtlı **tek** önceki Aqua hackathon projesi var — [Ballast](https://ethglobal.com/showcase/ballast-7jpyp), ETHGlobal NY 2026, 4. sırada — ve o **custom opcode** yazdı, yani farklı bir eksende ilerledi.
- 1inch'in Mart 2026'da çıkardığı MCP server agent'lara swap yaptırıyor ama **Aqua/SwapVM'e dokunmuyor.** Kompozisyon şeridi açık.

SwapVM'in kendisi derin bir substrate: `_limitSwap1D`, `_xycSwapXD`, `_xycConcentrateGrowLiquidity`, `_dutchAuctionBalanceIn1D`, `_oraclePriceAdjuster1D`, `_baseFeeAdjuster1D`, `_twap`, `_decay`, ve kontrol akışı için `_jump` / `_jumpIfTokenIn` / `_deadline`. Bunlardan doğru ve önemsiz-olmayan bir program kurmak gerçek DeFi mühendisliğidir.

**Kazanma tezi:** Jüri puanı SwapVM derinliğinden gelir, chatbox'tan değil. Bu yüzden sıralama **bytecode → gerçek execution → validator → LLM → UI** şeklindedir; tersi değil.

---

## 2. Konumlandırma — ne söylüyoruz, ne söylemiyoruz

| ✅ Söylediğimiz | ❌ Söylemediğimiz |
|---|---|
| "SwapVM instruction set'i için ilk composer" | "DeFi için bir AI agent" |
| "LLM kısıtlı parametreleri çıkarır, programı doğrulanmış şablon kurar" | "AI stratejiyi kendi kurar/derler" |
| "Fork üzerinde gerçek kontratlarda gerçek fill" | "Simülasyon / demo verisi" |
| "Çalıştırmadan önce validator geçer" | — (bu bizim en güçlü kartımız, öne çıkar) |

**Neden bu kadar katıyız:** "Doğal dil → DeFi stratejisi" kategorisi dolu (Enso, HeyAnon, Almanak, Giza — hepsi üretimde). Yeni olan tek şey **hedef substrate**. Agent anlatısıyla açarsak sahnedeki en az farklılaşmış şeyi öne koymuş oluruz.

---

## 3. Doğrulanmış teknik gerçekler (plan bunlara dayanıyor)

> Bu bölüm plandaki en kritik kısım. İlk brief'te bunlar yanlış varsayılmıştı.

1. **Aqua TypeScript SDK program kurmaz.** SDK `AquaProtocolContract`, `Ship`/`Dock` (sanal bakiye) ve event sınıfları sunar. README'sinde **SwapVM stratejisi örneği yoktur.** SDK'yı bakiye yönetimi ve event parsing için kullanacağız — program üretimi için değil.
2. **Gerçek composer Solidity tarafında.** `ProgramBuilder`, `swap-vm` reposunda ham `[opcode][len][args]` bytecode üretir. Bu layout'u **kontrat kaynağını okuyup TypeScript'e port edeceğiz.** İşin görünmeyen %80'i budur ve planın kritik yoludur.
3. **Komut sırası güvenlik-kritiktir.** SwapVM README'sinin kendi uyarısı: *aynı komutlar farklı sırada strateji davranışını değiştirebilir.* Bu yüzden LLM'e asla serbest opcode sıralatmıyoruz; deterministik şablon + validator zorunlu.
4. **Hazır şablon yok.** `docs/PROGRAMS.md` program *kategorilerini* tarif eder, ladder/TWAP/rebalance şablonu **vermez** ve geliştiriciden model kararlılığının analitik kanıtını ister. Şablonu biz yazıp biz doğrulayacağız.
5. **$100k bounty bir bug bounty'dir**, build grant değil. Güvenlik bulgusu / optimizasyon önerisi içindir, PoC ve ilk-bildiren şartı vardır. Planlamada takip fonu olarak sayılmaz.

---

## 4. Mimari

```
┌─────────────────────────────────────────────────────────────┐
│  UI  (Next.js)                                    [dev3]    │
│  cümle girişi · program görüntüleyici · validator paneli    │
│  lifecycle timeline (gerçek event'lerle beslenen)           │
└───────────────┬─────────────────────────────────────────────┘
                │ parametreler ↓            ↑ normalize event akışı
┌───────────────┴──────────────┐   ┌────────┴────────────────┐
│  Param Extractor   [dev3]    │   │  Event Normalizer [dev2]│
│  LLM · kısıtlı JSON şeması   │   │  Pushed/Pulled/         │
│  serbest metin → slotlar     │   │  Shipped/Docked → WS    │
└───────────────┬──────────────┘   └────────▲────────────────┘
                │                            │
┌───────────────┴────────────────────────────┴────────────────┐
│  Strategy Core                                    [dev1]    │
│  ProgramBuilder (TS port) · strateji şablonu · VALIDATOR    │
│  [opcode][len][args] serileştirme · byte-eşitlik testleri   │
└───────────────┬─────────────────────────────────────────────┘
                │ imzalı program bytes
┌───────────────┴─────────────────────────────────────────────┐
│  Execution Layer                                  [dev2]    │
│  Anvil mainnet fork · resmi Aqua + SwapVM kontratları       │
│  submit · karşı taraf swap motoru · cancel/settle           │
└─────────────────────────────────────────────────────────────┘
```

**Paket yapısı (npm workspaces):**

```
packages/
  strategy-core/     # dev1 — ProgramBuilder portu, şablon, validator (saf TS, ağ yok)
  execution/         # dev2 — fork, submit, karşı taraf, event normalizer
  web/               # dev3 — Next.js UI
  shared/            # ortak tipler: ProgramSpec, StrategyParams, LifecycleEvent
scripts/             # fork.mjs, seed.mjs, demo-reset.mjs, verify.mjs
contracts/           # Foundry — referans program + golden fixture üretimi
docs/
```

`shared/` **Gün 1'de** donar. Üç kişinin paralel çalışabilmesinin tek şartı bu tiplerin erken sabitlenmesidir.

---

## 5. Kapsam

### MVP (bunlar olmazsa proje yok)
- [ ] TS `ProgramBuilder` — Foundry referans çıktısıyla **byte-byte eşit**
- [ ] Bir adet önemsiz-olmayan strateji: dallanmalı (`_jumpIfTokenIn`) veya oracle-ayarlı (`_oraclePriceAdjuster1D`) çok bacaklı program
- [ ] Fork'ta uçtan uca: submit → **gerçek fill** → cancel/settle
- [ ] Validator: opcode sırası, `_deadline` varlığı, invalidator varlığı, adjuster konumu
- [ ] Gerçek event'lerle beslenen lifecycle UI
- [ ] LLM parametre çıkarımı (kısıtlı şema)

### Stretch (zaman kalırsa)
- [ ] İkinci strateji şablonu (TWAP veya rebalancing band)
- [ ] The Graph verisinin **karar yolunda** kullanımı
- [ ] Program diff görünümü (parametre değişince bytecode nasıl değişiyor)

### Kapsam dışı (bilerek yapmıyoruz)
- Custom opcode yazmak → başka bir projedir (Ballast'ın yolu); bizim iddiamız kompozisyon
- Mainnet deploy, çoklu zincir
- Üçüncü sponsor entegrasyonu → derinlikten çalar, DeFi jürisi ödüllendirmez
- Kullanıcı hesabı, kalıcı veritabanı, auth

---

## 6. Ekip ve roller

> Kapı şartı: **dev1 rolünü doldurabilecek, `swap-vm` Solidity kaynağını okuyup byte layout çıkarabilecek biri olmalı.** Bu kişi yoksa takım kaç kişi olursa olsun projenin gerçek %80'i yazılmaz ve elde bir chatbox kalır. 5 frontend developer bu projeyi bitiremez; doğru kompozisyonda 2 kişi bitirir.

### dev1 — SwapVM Protokol Mühendisi
*Projenin kazanma iddiasının tamamı burada. Kritik yol.*

**Sahiplik:** Byte seviyesinde doğru SwapVM programı üretmek ve doğruluğunu kanıtlamak.

**Beceriler:** Solidity okuma akıcılığı · Foundry · ABI/bytecode encoding sezgisi · DeFi mekaniği (limit order, TWAP, oracle adjuster, invalidator/deadline semantiği).

**Teslimler:**
1. Opcode envanteri + argüman layout notu (`docs/swapvm-opcodes.md`) — takımın geri kalanı bundan beslenir
2. TS `ProgramBuilder` portu + byte-eşitlik test paketi
3. Strateji şablonu v1 — dallanmalı veya oracle-ayarlı çok bacaklı program
4. Validator + simülasyon önizlemesi

**Devirler:** encoder → dev2 (çalıştırma için) · parametre şeması → dev3 (LLM slotları) · validator çıktısı → dev3 (UI paneli)

**Yapmaz:** UI, prompt, slayt. Custom opcode yazmaya heveslenmez.

---

### dev2 — Execution & Fork Mühendisi
*"Mocked değil" iddiasını taşıyan kişi.*

**Sahiplik:** Programın gerçek kontratlara gidip gerçekten dolması, iptal edilmesi ve settle olması.

**Beceriler:** Anvil / fork tooling · viem veya ethers · Node backend · ERC-20 fonlama & account impersonation · event indeksleme. Solidity okuyabilmesi iyi, yazması şart değil.

**Teslimler:**
1. Fork ortamı — resmi Aqua + SwapVM adresleri, fonlama, **idempotent reset script'i**
2. Submit yolu — imzalı program → kontrat
3. Karşı taraf swap motoru — fill'leri **gerçekten** üreten script (frontend'de sayaç döndürmek değil)
4. Event normalizer — `Pushed` / `Pulled` / `Shipped` / `Docked` → tek normalize akış → WS
5. *(Opsiyonel)* The Graph entegrasyonu — yalnızca karar yolundaysa

**Devirler:** event şeması → dev3'e **Gün 1'de** · çalışan fork script'i → herkese

**Yapmaz:** Bytecode encoding'e paralel ikinci bir çözüm denemez — ikili implementasyon zaman öldürür.

---

### dev3 — Ürün Mühendisi (Lifecycle UI + LLM)
*Jürinin gördüğü yüzey. En az kod, en çok görünürlük.*

**Sahiplik:** Demo'nun anlaşılır olması.

**Beceriler:** React / Next.js · canlı veri & durum yönetimi (WS) · structured output ile LLM çağrısı · tasarım zevki.

**Teslimler:**
1. Lifecycle UI — programın doğuşundan settle'ına: adımlar görünür, her fill gerçek event'le düşer, cancel/settle net *(işinin ~%70'i)*
2. Validator görselleştirmesi — "çalıştırmadan önce şunları kontrol ettik" paneli
3. LLM parametre çıkarımı — cümle → kısıtlı JSON şeması → dev1'in şablonuna *(yarım günden az)*
4. Anlatı — README + demo videosu, §2'deki konumlandırmayla

**Yapmaz:** LLM'e serbest opcode sıralatmaz. Demo'da hiçbir sayıyı frontend'de üretmez — ekrandaki her rakamın arkasında bir event olur.

---

## 7. 5 Günlük Plan

**Varsayım:** 5 gün = kesintisiz build penceresi. Bunun bir kısmı resmi etkinlik dışındaysa, Gün 1–2'yi **öğrenme + atılacak spike kodu** olarak tutun; ETHGlobal etkinlik sırasında yazılmış kod ister ve 1inch commit geçmişini açıkça kontrol eder.

**Her günün sonunda bir GATE var.** Gate düşerse ertesi gün ilk iş §9'daki düşme merdivenine bakılır — plan kovalanmaz, kapsam kesilir.

---

### 🟦 Gün 1 — Temel: okuma, iskelet, fork ayakta

| | Görev |
|---|---|
| **dev1** | `swap-vm` reposu + `docs/PROGRAMS.md` okuması → **opcode envanteri notu**. Foundry ile referans program derleyip byte çıktısını **golden fixture** olarak dosyaya alır (`contracts/fixtures/`). Bu fixture Gün 2'nin test oracle'ıdır. |
| **dev2** | Monorepo iskeleti + `scripts/fork.mjs` (Anvil, resmi Aqua/SwapVM adresleri, hesap fonlama, impersonation, **tek komutla reset**). Kontratlara ilk read çağrısı yeşil. |
| **dev3** | Next.js iskeleti, tasarım dili, lifecycle timeline bileşeninin statik hali. |
| **Ortak** | `packages/shared` tipleri: `ProgramSpec`, `StrategyParams`, `LifecycleEvent`. **Gün sonunda donar.** |

**🚪 GATE 1:** Fork ayakta ve reset ediliyor · golden fixture dosyada · `shared` tipleri commit'lendi.

---

### 🟩 Gün 2 — Encoder ve submit yolu

| | Görev |
|---|---|
| **dev1** | **TS `ProgramBuilder` portu.** Tip başına encoder (uint/address/bytes/dizi), `[opcode][len][args]` serileştirme. Golden fixture'a karşı byte-eşitlik testleri. |
| **dev2** | Submit yolu: imzalama + kontrata gönderim. Karşı taraf swap script'inin taslağı. Event dinleyicisi ham haliyle çalışıyor. |
| **dev3** | UI iskeleti **fixture event'lerle** uçtan uca akıyor (canlı akış Gün 3'te bağlanacak). Program byte'larını okunur gösteren viewer. |

**🚪 GATE 2 — planın en kritik kapısı:** TS encoder çıktısı Foundry çıktısıyla **byte-byte eşit.**
*Kaçarsa:* Gün 3 sabahı dev2 encoder'a takviyeye geçer, strateji karmaşıklığı bir kademe düşürülür.

---

### 🟨 Gün 3 — İlk gerçek fill (uçtan uca)

| | Görev |
|---|---|
| **dev1** | Strateji şablonu v1: dallanmalı (`_jumpIfTokenIn`) veya oracle-ayarlı (`_oraclePriceAdjuster1D`) çok bacaklı program + Foundry testleri. `_deadline` ve invalidator dahil. |
| **dev2** | **Gerçek fill.** Karşı taraf swap'leri programı dolduruyor; kısmi doluluk, cancel ve settle çalışıyor. Event normalizer → WS → UI. |
| **dev3** | UI canlı akışa bağlanıyor. Kısmi fill, cancel ve settle durumları ekranda doğru görünüyor. |

**🚪 GATE 3 — projenin belkemiği:** Uçtan uca happy path yeşil — imzalı program → submit → gerçek fill → cancel/settle, hepsi gerçek event'lerle UI'da.
*Bu gate kaçarsa The Graph ve UI cilası aynı gün masadan kalkar.*

---

### 🟧 Gün 4 — Validator + LLM + sağlamlaştırma

| | Görev |
|---|---|
| **dev1** | **Validator:** opcode sıra kuralları, eksik `_deadline`, eksik invalidator (replay riski), yanlış konumdaki adjuster, aralık/parametre sınırları. Ek olarak `eth_call` ile simülasyon önizlemesi. |
| **dev2** | The Graph'i karar yoluna sokar *(§8 koşulu sağlanıyorsa)*, sağlanmıyorsa sağlamlaştırma + `scripts/demo-reset.mjs` (tek komutla temiz demo ortamı) + yedek senaryolar. |
| **dev3** | Validator paneli UI'da. **LLM parametre çıkarımı**: cümle → kısıtlı JSON şeması → şablon. Reddedilen/sınır dışı parametre senaryoları. |

**🚪 GATE 4:** Sınır dışı bir prompt (ör. anlamsız aralık, süresiz program) validator tarafından **reddediliyor ve gerekçesi ekranda görünüyor.** Bu, demo'nun en güçlü anıdır.

---

### 🟥 Gün 5 — Demo, cila, submission

**Sabah: feature freeze.** Yeni özellik yok, sadece bugfix.

| | Görev |
|---|---|
| **dev1** | Q&A hazırlığı: bytecode walkthrough — "bu byte dizisi ne, sıra neden bu, neden güvenli". **Sunumu dev1 yapar.** |
| **dev2** | Temiz demo ortamı, tek komutla reset+seed, ağ/fork çökme senaryosu için yedek. Demo'nun **yedek video kaydı**. |
| **dev3** | Demo videosu, README (mimari şeması + §2 konumlandırması), submission formu. |

**🚪 GATE 5:** Demo, **iki kez ardışık ve sıfır manuel müdahaleyle** çalıştı · video kaydedildi · submission gönderildi.

---

## 8. The Graph kararı (tek bir soruyla)

> **Graph sorgusu stratejinin kararını değiştiriyor mu?**
> Örn. canlı volatilite/likidite verisi merdiven aralığını daralttı ya da rebalance tetiğini oynattı mı?

- **Evet** → Gün 4'te dev2 ekler, ikinci track'e girilir (+$3.000 potansiyeli).
- **Hayır** → **Girilmez.** Karar yolunda olmayan bir token-fiyat okuması "effective use" kriterinden sıfıra yakın alır ve boşa 5–7 saat götürür.

Kararı **Gün 3 akşamı** verin, daha erken değil — Gate 3'ün durumu bu kararı belirler.

---

## 9. Risk kaydı ve düşme merdiveni

| Risk | Olasılık | Etki | Karşılık |
|---|---|---|---|
| Byte layout'u yanlış çıkarmak | Orta | **Kritik** | Golden fixture Gün 1'de hazır; her encoder değişikliği ona karşı test edilir |
| Encoder Gün 2'de bitmez | Orta | Kritik | dev2 takviyeye geçer, strateji bir kademe basitleşir (dallanma → oracle adjuster) |
| Fork'ta Aqua adresleri / state sorunları | Orta | Yüksek | Fallback: kontratları yerel olarak deploy edip aynı akışı sürmek |
| Oracle adjuster için fiyat kaynağı | Düşük | Orta | Fork'ta Chainlink feed'i doğrudan okunur |
| LLM entegrasyonu uzar | Düşük | Düşük | 3 hazır preset + manuel form; serbest metin girişi opsiyonel hale gelir |
| Demo anında ortam bozulur | Orta | Yüksek | `demo-reset.mjs` + Gün 5'te çekilmiş yedek video |

**Düşme merdiveni — sırayla feda edilir:**
1. The Graph track'i
2. UI cilası (animasyon, tema, responsive detayları)
3. İkinci strateji şablonu
4. LLM'in serbest metin girişi → hazır preset'lere düşülür

**Asla feda edilmez:** fork'ta gerçek execution · validator. Bu ikisi gidince ortada proje kalmaz.

---

## 10. Demo senaryosu (~90 saniye)

1. Kullanıcı cümleyi yazar: *"ETH'yi 2.000$'dan 1.800$'a beş kademede topla, oracle 3%'ten fazla saparsa durdur."*
2. Ekranda **çıkarılan parametreler** görünür — model bunları doldurdu, programı kurmadı.
3. **Program byte'ları** okunur biçimde açılır: opcode'lar, argümanlar, `_deadline`, invalidator.
4. **Validator geçer** — hangi kuralların kontrol edildiği tek tek görünür. *(Sonra bilerek bozuk bir prompt denenir ve reddedilir.)*
5. Submit → forklanmış mainnet'teki resmi kontratlar.
6. Karşı taraf swap'leri gelir, **gerçek `Pushed`/`Pulled` event'leriyle** kademeler dolar.
7. Kısmi doluluk gösterilir → cancel/settle.

**Kural:** Ekrandaki hiçbir sayı frontend'de üretilmez. Her rakamın arkasında bir zincir event'i vardır.

---

## 11. Çalışma kuralları (repo disiplini)

1inch commit geçmişini **açıkça kontrol ediyor** — tek seferlik deadline dump'ı elenme sebebi. Bu yüzden disiplin sadece estetik değil, puan meselesi.

- **Dallanma:** `main` (release-only) · `dev` (entegrasyon, default) · `feat|fix|refactor|chore/*` → `dev`
- **PR-only, squash-merge, merge sonrası dal silinir.** Doğrudan `dev`/`main`'e push yok.
- **Conventional Commits**, küçük harf konu, ≤72 karakter. Kademeli commit — her gün en az birkaç anlamlı commit.
- **Commit'lerde sıfır AI atfı:** `Co-Authored-By` yok, "Generated with…" yok, 🤖 yok, author/committer/mesajda "Claude" geçmez.
- **Husky hook'ları asla atlanmaz** (`--no-verify` yasak).
- `verify` = typecheck + lint + format:check + build — push öncesi yeşil olacak.
- Kurulum/ops adımları **`scripts/` altında idempotent ve cross-platform script'lerle** yapılır, elle komutlarla değil.
- Büyük adımlardan önce kısa plan paylaşılır, onay alınır.

---

## 12. Submission kontrol listesi

- [ ] Public repo, kademeli commit geçmişi (tek dump değil)
- [ ] **Resmi** Aqua + SwapVM kontratları kullanılıyor (local fork açıkça kabul)
- [ ] Demo'da **onchain execution** var, core iddiada hiçbir şey mocked değil
- [ ] README: mimari şeması + §2 konumlandırması + kurulum adımları
- [ ] Demo videosu
- [ ] Track'ler: 1inch Aqua *(+ The Graph — yalnızca §8 koşulu sağlandıysa)*
- [ ] Üçüncü sponsor eklenmedi

---

## 13. Kaynaklar

**Birincil**
- https://github.com/1inch/swap-vm
- https://github.com/1inch/swap-vm/blob/main/docs/PROGRAMS.md
- https://github.com/1inch/aqua
- https://github.com/1inch/sdks/tree/master/typescript/aqua
- https://1inch.com/aqua
- https://1inch.com/blog/post/aqua-developer-release

**Prior art**
- https://ethglobal.com/showcase/ballast-7jpyp
- https://www.prnewswire.com/news-releases/1inch-enables-ai-agents-to-access-api-suite-including-swap-execution-via-mcp-302728644.html

**Etkinlik**
- https://ethglobal.com/events/lisbon2026/prizes
