<!-- Keep PRs small and atomic. Base branch should be `dev` (features) or `main` (releases only). -->

## What & why

<!-- What does this change do, and why is it needed? -->

## How to verify

<!-- Steps a reviewer can follow to confirm it works (commands, URLs, screenshots). -->

## Checklist

- [ ] Branch is based off `dev` (or `main` for a release)
- [ ] Commits follow Conventional Commits (lowercase subject, imperative, ≤ 72 chars)
- [ ] `npm run verify` passes locally (typecheck + lint + format:check + build)
- [ ] No direct pushes to `main`/`dev`; hooks were not bypassed
- [ ] Docs updated if behavior or setup changed
