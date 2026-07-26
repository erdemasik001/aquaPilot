/**
 * Conventional Commits, enforced on every commit via the commit-msg hook.
 *
 * Allowed types: feat, fix, chore, refactor, docs, style, perf, test, build, ci, revert.
 * Subject must not be sentence-cased (start lowercase), imperative mood, <= 72 chars.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
  },
};
