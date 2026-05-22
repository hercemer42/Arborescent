import { describe, it, expect } from 'vitest';
import { homedir } from 'node:os';
import { encodeClaudeProjectDir, resolveClaudeSessionFile } from '../claudeSessionHandlers';

describe('encodeClaudeProjectDir', () => {
  it('replaces every slash with a dash to match the Claude CLI on-disk encoding', () => {
    expect(encodeClaudeProjectDir('/Users/foo/dev/repo')).toBe('-Users-foo-dev-repo');
  });

  it('leaves a path without slashes untouched', () => {
    expect(encodeClaudeProjectDir('repo')).toBe('repo');
  });

  it('handles trailing slashes by encoding them', () => {
    expect(encodeClaudeProjectDir('/a/b/')).toBe('-a-b-');
  });

  it('encodes dotted segments the same way the Claude CLI does (e.g. `.claude` → `-claude`)', () => {
    expect(encodeClaudeProjectDir('/Users/me/repo/.claude/worktrees/wt'))
      .toBe('-Users-me-repo--claude-worktrees-wt');
  });
});

describe('resolveClaudeSessionFile', () => {
  it('resolves to ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl', () => {
    const file = resolveClaudeSessionFile('/Users/foo/dev/repo', 'abc-123');
    expect(file).toBe(`${homedir()}/.claude/projects/-Users-foo-dev-repo/abc-123.jsonl`);
  });
});
