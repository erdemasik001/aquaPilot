#!/usr/bin/env node
/**
 * Cross-platform verify runner (used by the pre-push hook and CI).
 * Runs the quality gates in order, fail-fast: typecheck -> lint -> format:check -> build.
 *
 * Never bypass this. If a gate fails, fix the root cause instead of skipping the hook.
 */
import { spawnSync } from 'node:child_process';

const steps = ['typecheck', 'lint', 'format:check', 'build'];

for (const step of steps) {
  process.stdout.write(`\n▶ verify: ${step}\n`);
  const result = spawnSync('npm', ['run', step], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.stderr.write(`\n✖ verify failed at: ${step}\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write('\n✔ verify passed\n');
