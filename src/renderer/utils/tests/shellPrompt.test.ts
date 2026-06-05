import { describe, it, expect } from 'vitest';

import { isShellPromptReady } from '../shellPrompt';

describe('isShellPromptReady', () => {
  it('treats bracketed-paste enable as ready regardless of the surrounding prompt text', () => {
    expect(isShellPromptReady('\x1b[?2004hanything at all')).toBe(true);
  });

  it('detects a standard bash/zsh prompt that ends in $, %, or #', () => {
    expect(isShellPromptReady('\r\nuser@host:~/project$ ')).toBe(true);
    expect(isShellPromptReady('\r\nuser@host project % ')).toBe(true);
    expect(isShellPromptReady('\r\nroot@host:/# ')).toBe(true);
  });

  it('detects a prompt terminator wrapped in ANSI colour codes', () => {
    expect(isShellPromptReady('\x1b[32muser@host\x1b[0m:\x1b[34m~/p\x1b[0m$ ')).toBe(true);
  });

  it('detects a coloured terminator followed by a trailing reset sequence', () => {
    expect(isShellPromptReady('\x1b[32m$\x1b[0m ')).toBe(true);
  });

  it('detects a modern powerline-style prompt ending in ❯', () => {
    expect(isShellPromptReady('~/project ❯ ')).toBe(true);
  });

  it('is not ready on empty output', () => {
    expect(isShellPromptReady('')).toBe(false);
  });

  it('is not ready while the shell is still printing startup output with no prompt yet', () => {
    expect(isShellPromptReady('Last login: Mon Jun 5 on ttys000\r\nLoading profile...')).toBe(false);
  });

  it('is not ready on a partial prompt that has not reached its terminator', () => {
    expect(isShellPromptReady('\r\nuser@host:~/very/long/path/being/typ')).toBe(false);
  });

  it('does not declare readiness for a custom prompt ending in a non-standard terminator', () => {
    // A documented limitation: prompts that neither enable bracketed paste nor
    // end in a recognised terminator fall back to the readiness timeout.
    expect(isShellPromptReady('~/project ➜ ')).toBe(false);
  });
});
