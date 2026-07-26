#!/usr/bin/env node
/**
 * Idempotent repository merge settings: squash-only, auto-delete merged branches,
 * default branch = dev, squash commit message = PR title + body. Safe to re-run.
 *
 * Requires: `dev` branch to exist and gh authenticated with admin rights.
 * Usage: node scripts/setup-repo.mjs
 *   REPO env var overrides the target (default: YTU-BLOCKCHAIN/Aktan).
 */
import { spawnSync } from 'node:child_process';

const REPO = process.env.REPO ?? 'YTU-BLOCKCHAIN/Aktan';

function run(cmd, args) {
  process.stdout.write(`\n▶ ${cmd} ${args.join(' ')}\n`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.stderr.write('\n✖ command failed\n');
    process.exit(result.status ?? 1);
  }
}

// Merge model: squash only, auto-delete merged branches, integrate on dev.
run('gh', [
  'repo',
  'edit',
  REPO,
  '--enable-squash-merge',
  '--enable-merge-commit=false',
  '--enable-rebase-merge=false',
  '--delete-branch-on-merge',
  '--default-branch',
  'dev',
]);

// Squash commit message = PR title + body (clean history, no per-commit trailers).
run('gh', [
  'api',
  '--method',
  'PATCH',
  `repos/${REPO}`,
  '-f',
  'squash_merge_commit_title=PR_TITLE',
  '-f',
  'squash_merge_commit_message=PR_BODY',
  '-F',
  'allow_update_branch=true',
]);

process.stdout.write('\n✔ repository merge settings applied\n');
