#!/usr/bin/env node
/**
 * Run an npm script across all workspaces, but no-op cleanly when there are none yet.
 * (`npm run <script> --workspaces` errors with "No workspaces found!" on an empty monorepo,
 * which `--if-present` does not suppress.)
 *
 * Usage: node scripts/workspaces-run.mjs <script>
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = process.argv[2];
if (!script) {
  process.stderr.write('usage: node scripts/workspaces-run.mjs <script>\n');
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function hasWorkspaces() {
  for (const root of ['apps', 'packages']) {
    const rootDir = join(repoRoot, root);
    if (!existsSync(rootDir)) continue;
    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(rootDir, entry.name, 'package.json'))) {
        return true;
      }
    }
  }
  return false;
}

if (!hasWorkspaces()) {
  process.stdout.write(`(no workspaces yet — skipping "${script}")\n`);
  process.exit(0);
}

const result = spawnSync('npm', ['run', script, '--workspaces', '--if-present'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
