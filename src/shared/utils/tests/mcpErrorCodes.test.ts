import { describe, it, expect } from 'vitest';

import {
  MCP_ERROR_CODES,
  MCP_ERROR_MESSAGES,
  type McpErrorCode,
} from '../mcpErrorCodes';

// The error code namespace is a published contract: codes are stable and
// additive, prose is freely rewordable. This table test pins the contract
// the same way mcpTreeReadErrorTaxonomyMessages.test.ts pins the read-path
// taxonomy — every code must exist, be unique, live in a namespace, and
// carry a default message. Renaming a code is a breaking change and must
// fail here.

const ALL_CODES = Object.values(MCP_ERROR_CODES) as McpErrorCode[];

describe('mcpErrorCodes — namespace shape', () => {
  it('every code is unique', () => {
    expect(new Set(ALL_CODES).size).toBe(ALL_CODES.length);
  });

  it('every code belongs to the read, write, or applier sub-namespace', () => {
    for (const code of ALL_CODES) {
      expect(code).toMatch(/^(read|write|applier)\/[a-z][a-z-]*$/);
    }
  });

  it('the three read-path kinds are folded into the namespace with their existing kind names', () => {
    expect(ALL_CODES).toContain('read/not-ready');
    expect(ALL_CODES).toContain('read/no-session-store');
    expect(ALL_CODES).toContain('read/node-not-in-open-store');
  });

  it('the write sub-namespace covers every gated submit/write failure', () => {
    expect(ALL_CODES).toContain('write/unbound');
    expect(ALL_CODES).toContain('write/no-context');
    expect(ALL_CODES).toContain('write/mode-refusal');
    expect(ALL_CODES).toContain('write/target-drift');
    expect(ALL_CODES).toContain('write/missing-token');
    expect(ALL_CODES).toContain('write/outside-bound-subtree');
    expect(ALL_CODES).toContain('write/manual-step');
    expect(ALL_CODES).toContain('write/upstream-failure');
  });

  it('the applier sub-namespace covers exactly the five distinct failure modes', () => {
    const applierCodes = ALL_CODES.filter((code) => code.startsWith('applier/'));
    expect(applierCodes.sort()).toEqual([
      'applier/applier-threw',
      'applier/no-store',
      'applier/node-not-found',
      'applier/routing-disagreement',
      'applier/workflow-handler-unavailable',
    ]);
  });
});

describe('mcpErrorCodes — code-to-message table', () => {
  it('every code has a non-empty default message', () => {
    for (const code of ALL_CODES) {
      const message = MCP_ERROR_MESSAGES[code];
      expect(message, `missing message for ${code}`).toBeTruthy();
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it('the message table has no entries for codes outside the enum', () => {
    for (const key of Object.keys(MCP_ERROR_MESSAGES)) {
      expect(ALL_CODES).toContain(key as McpErrorCode);
    }
  });

  it('default messages are mutually distinguishable', () => {
    const messages = ALL_CODES.map((code) => MCP_ERROR_MESSAGES[code]);
    expect(new Set(messages).size).toBe(messages.length);
  });
});
