# Security policy

Aktan is an early-stage hackathon project. It runs on **testnets only** and its smart contracts
are **not audited**. Do not use it with mainnet funds or real personal data.

## Reporting a vulnerability

Please report security issues privately using GitHub's
[private vulnerability reporting](https://github.com/YTU-BLOCKCHAIN/Aktan/security/advisories/new)
rather than opening a public issue. We will acknowledge and follow up as soon as we can.

## Known limitations (by design, for now)

- `onlyOwner` contract controls use a single backend wallet (production would need multisig +
  rate limits).
- Anti-fraud is heuristic (signed telemetry, rate limits, one-human-one-account via World ID).
