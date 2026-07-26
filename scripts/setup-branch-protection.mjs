#!/usr/bin/env node
/**
 * Idempotent branch protection for `main` and `dev` via the GitHub REST API (gh CLI).
 * Applies scripts/branch-protection.json to each branch. Safe to re-run.
 *
 * Requires: gh authenticated with admin rights on the repo.
 * Usage: node scripts/setup-branch-protection.mjs
 *   REPO env var overrides the target (default: YTU-BLOCKCHAIN/Aktan).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = process.env.REPO ?? 'YTU-BLOCKCHAIN/Aktan';
const BRANCHES = ['main', 'dev'];

const here = dirname(fileURLToPath(import.meta.url));
const payload = readFileSync(join(here, 'branch-protection.json'), 'utf8');

for (const branch of BRANCHES) {
  process.stdout.write(`\n▶ protecting ${REPO}@${branch}\n`);
  const result = spawnSync(
    'gh',
    ['api', '--method', 'PUT', `repos/${REPO}/branches/${branch}/protection`, '--input', '-'],
    { input: payload, stdio: ['pipe', 'inherit', 'inherit'], shell: true },
  );
  if (result.status !== 0) {
    process.stderr.write(`\n✖ failed to protect ${branch}\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write('\n✔ branch protection applied to main + dev\n');
