# Contributing to Aktan

Thanks for contributing! This repo keeps a clean history and consistent style from day one.
The rules below are enforced by git hooks and CI — please work with them, not around them.

## Branch model

| Branch       | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `main`       | Production. Updated **only** through releases.           |
| `dev`        | Default / integration branch. All work lands here first. |
| `feat/*`     | New features (branched from `dev`).                      |
| `fix/*`      | Bug fixes.                                               |
| `refactor/*` | Refactors with no behavior change.                       |
| `chore/*`    | Tooling, deps, meta.                                     |

**No direct pushes to `main` or `dev`.** Everything goes through a pull request.

## Commits — Conventional Commits

Format: `type(scope): subject`

- **Types:** `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `perf`, `test`, `build`, `ci`, `revert`.
- **Subject:** lowercase start (not sentence-case), imperative mood, ≤ 72 characters.
- **Scope:** optional but encouraged, e.g. `feat(nav): add sidebar`.
- **Atomic:** one logical change per commit.

Examples:

```
feat(backend): add auction endpoint for ad selection
fix(extension): debounce impression events
docs: document withdraw flow
```

commitlint rejects non-conforming messages via the `commit-msg` hook.

## Quality gates (husky)

Installed automatically on `npm install`:

- **pre-commit** → `lint-staged` (`eslint --fix` + `prettier --write` on staged files)
- **commit-msg** → `commitlint` (Conventional Commits)
- **pre-push** → `npm run verify` = **typecheck + lint + format:check + build**

**Do not bypass hooks** (`--no-verify`, etc.). If a gate fails, fix the root cause. If `verify`
is red, do not push.

## Pull request flow (feature → dev)

1. Branch from an up-to-date `dev`: `git switch dev && git pull && git switch -c feat/thing`.
2. Make atomic, conventional commits.
3. `git push` (pre-push runs `verify`).
4. `gh pr create --base dev` with a clear title and body (what/why + how to verify).
5. Squash-merge and delete the branch.
6. `git fetch --prune` and update your local `dev`.

## Release flow (dev → main)

Releases are squash-merged so `main` carries one clean release commit per release, and `main`
ends up content-identical to `dev`. `dev` is never deleted.

## Repository automation

Repeatable ops live in [`scripts/`](scripts/) and are idempotent:

- `npm run verify` — run all quality gates locally.
- `npm run setup:repo` — apply merge settings (squash-only, auto-delete branches, default `dev`).
- `npm run setup:branch-protection` — apply branch protection to `main` + `dev`.
