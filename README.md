# AquaPilot

> **The first strategy composer for the 1inch SwapVM instruction set.**

AquaPilot turns a plain-language intent into a **validated, multi-leg SwapVM program**, then executes it against the official 1inch Aqua/SwapVM contracts on a mainnet fork — with every fill, cancel and settlement in the UI driven by real on-chain events.

**Event:** ETHGlobal Lisbon 2026 · **Track:** 1inch — Build an Aqua App
**Status:** Day 1 of 5 — protocol reconnaissance complete, encoder port next.

---

## What this is, precisely

It is **not** "an AI agent for DeFi." The pipeline is deliberately inverted from the usual DeFAI demo:

```
sentence ──▶ constrained parameters ──▶ deterministic template ──▶ VALIDATOR ──▶ fork execution
          (model's only job)          (human-authored)         (the feature)   (real fills)
```

A human authors and verifies the program template. The model only fills typed parameter slots. A validator checks instruction order and safety invariants **before** anything executes.

## Why it exists

1inch shipped Aqua and SwapVM for developers in November 2025. As of today there is **no public Aqua frontend** and **no first-party natural-language SwapVM composer**. SwapVM is a real instruction VM — limit swaps, AMM curves, concentrated liquidity, Dutch auctions, TWAP, MEV decay, and `Jump`/`JumpIfTokenIn` control flow — and composing a correct non-trivial program from it is genuine DeFi engineering.

The SwapVM documentation warns that instruction order is security-critical: the same instructions in a different order can change strategy behavior. AquaPilot treats that warning as the product — **the validator is the feature, not a footnote.**

## Progress

|     | Milestone                                                                                                  | Gate  |
| --- | ---------------------------------------------------------------------------------------------------------- | ----- |
| ✅  | SwapVM encoding + opcode inventory verified from source → [docs/swapvm-opcodes.md](docs/swapvm-opcodes.md) | Day 1 |
| ☐   | TypeScript `ProgramBuilder` port, byte-equal to Foundry output                                             | Day 2 |
| ☐   | Fork execution: submit → **real fill** → cancel/settle                                                     | Day 3 |
| ☐   | Program validator + simulation preview                                                                     | Day 4 |
| ☐   | Lifecycle UI on real events · parameter extraction                                                         | Day 4 |
| ☐   | Demo, README, submission                                                                                   | Day 5 |

Full plan, roles and daily gates: [docs/aquapilot-plan.md](docs/aquapilot-plan.md).

## Key findings from source (Day 1)

- **Program encoding is `[1 byte opcode][1 byte argsLength][args]`** — confirmed from both the encoder (`ProgramBuilder.build`) and the decoder (`ContextLib.runLoop`). Arguments cap at 255 bytes per instruction; jump-addressable programs cap at 65,535 bytes.
- **Aqua is a `MakerTraits` bit flag (`1 << 254`), not an opcode set.** This decides the architecture: `SwapVMRouter` with `useAquaInsteadOfSignature = true` gives the _full_ instruction set **and** Aqua-backed settlement. `AquaSwapVMRouter` does not dispatch `LimitSwap`, `StaticBalances` or the invalidators at all — a limit-order ladder is impossible there.
- **`OraclePriceAdjuster` is unusable as shipped.** The instruction exists in source and appears in the architecture diagram, but it has no entry in the `Opcode` enum and is dispatched by no opcode set.

These findings and the derived validator rule base (R1–R10) are documented in [docs/swapvm-opcodes.md](docs/swapvm-opcodes.md).

## Repository layout

```
apps/web/                Next.js lifecycle UI
packages/shared/         Shared types: ProgramSpec, StrategyParams, LifecycleEvent
packages/strategy-core/  ProgramBuilder port, strategy templates, validator
packages/execution/      Fork orchestration, submit path, counterparty engine, event normalizer
contracts/               Foundry: reference programs and golden fixtures
scripts/                 Idempotent, cross-platform setup and ops scripts
docs/                    Plan and protocol notes
```

## Getting started

Prerequisites: **Node 22** (`.nvmrc`), **npm 10+**, and **Foundry**.

```bash
npm install
```

```bash
npm run verify
```

`verify` runs typecheck + lint + format:check + build. It must be green before any push.

## Development workflow

- **Branches:** `main` (release-only) · `dev` (integration) · `feat/*`, `fix/*`, `refactor/*`, `chore/*` from `dev`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint.
- **Quality gates:** husky runs lint-staged on commit, commitlint on the message, and `verify` before push. CI re-runs `verify` on every push and PR. Hooks are never bypassed.
- Everything reaches `dev`/`main` through a squash-merged pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Acknowledgements

Built on [1inch Aqua](https://1inch.com/aqua) and [1inch SwapVM](https://github.com/1inch/swap-vm). SwapVM sources are read as reference under their own license; **no 1inch code is vendored into this repository.**

## License

[MIT](LICENSE)
