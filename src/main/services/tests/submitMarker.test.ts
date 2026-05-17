import { describe, it, expect } from 'vitest';

// PR6 — per-session "submitted this turn" flag. Exists so that two paths
// converging on submit_step_output (Claude's explicit call and the Stop hook's
// auto-submit safety net) don't both apply the same response. A new turn —
// signalled by UserPromptSubmit / SessionStart firing register-binding — resets
// the flag so the next response can land.
import { SubmitMarker } from '../submitMarker';

describe('SubmitMarker — basic state', () => {
  it('a fresh session has not submitted', () => {
    const marker = new SubmitMarker();
    expect(marker.hasSubmitted('sess-1')).toBe(false);
  });

  it('markSubmitted flips the flag to true for that session only', () => {
    const marker = new SubmitMarker();
    marker.markSubmitted('sess-1');
    expect(marker.hasSubmitted('sess-1')).toBe(true);
    expect(marker.hasSubmitted('sess-2')).toBe(false);
  });

  it('reset clears the flag for the given session', () => {
    const marker = new SubmitMarker();
    marker.markSubmitted('sess-1');
    marker.reset('sess-1');
    expect(marker.hasSubmitted('sess-1')).toBe(false);
  });

  it('reset is a no-op when the session has never been marked', () => {
    const marker = new SubmitMarker();
    expect(() => marker.reset('never-marked')).not.toThrow();
    expect(marker.hasSubmitted('never-marked')).toBe(false);
  });

  it('marking the same session twice is idempotent', () => {
    const marker = new SubmitMarker();
    marker.markSubmitted('sess-1');
    marker.markSubmitted('sess-1');
    expect(marker.hasSubmitted('sess-1')).toBe(true);
  });
});

describe('SubmitMarker — boundary inputs', () => {
  it('empty session id is rejected (does not silently mark or query the empty key)', () => {
    const marker = new SubmitMarker();
    marker.markSubmitted('');
    expect(marker.hasSubmitted('')).toBe(false);
  });

  it('many sessions remain independent — marking one does not bleed into another', () => {
    const marker = new SubmitMarker();
    for (let i = 0; i < 50; i++) marker.markSubmitted(`sess-${i}`);
    for (let i = 0; i < 50; i++) expect(marker.hasSubmitted(`sess-${i}`)).toBe(true);
    expect(marker.hasSubmitted('sess-50')).toBe(false);
  });
});

describe('SubmitMarker — clear (full reset)', () => {
  it('clear() removes every marker — used on app restart / MCP server stop', () => {
    const marker = new SubmitMarker();
    marker.markSubmitted('sess-1');
    marker.markSubmitted('sess-2');
    marker.clear();
    expect(marker.hasSubmitted('sess-1')).toBe(false);
    expect(marker.hasSubmitted('sess-2')).toBe(false);
  });
});
