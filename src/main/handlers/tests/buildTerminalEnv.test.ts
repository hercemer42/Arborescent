import { describe, it, expect } from 'vitest';
import { buildTerminalEnv } from '../buildTerminalEnv';

describe('buildTerminalEnv', () => {
  it('returns undefined when hookEnv is empty and no node UUID is provided', () => {
    expect(buildTerminalEnv('term-1', {})).toBeUndefined();
    expect(buildTerminalEnv('term-1', {}, undefined)).toBeUndefined();
  });

  it('returns the hookEnv plus ARBORESCENT_TERMINAL_ID when hookEnv is non-empty and no node UUID is provided', () => {
    const env = buildTerminalEnv('term-2', {
      ARBORESCENT_HOOK_PORT: '17832',
      ARBORESCENT_AUTH_TOKEN: 'token-abc',
    });

    expect(env).toEqual({
      ARBORESCENT_HOOK_PORT: '17832',
      ARBORESCENT_AUTH_TOKEN: 'token-abc',
      ARBORESCENT_TERMINAL_ID: 'term-2',
    });
  });

  it('injects ARBORESCENT_NODE_UUID when provided', () => {
    const env = buildTerminalEnv(
      'term-3',
      { ARBORESCENT_HOOK_PORT: '17832' },
      'node-uuid-abc'
    );
    expect(env?.ARBORESCENT_NODE_UUID).toBe('node-uuid-abc');
  });

  it('omits ARBORESCENT_NODE_UUID when node UUID is an empty string', () => {
    const env = buildTerminalEnv(
      'term-4',
      { ARBORESCENT_HOOK_PORT: '17832' },
      ''
    );
    expect(env?.ARBORESCENT_NODE_UUID).toBeUndefined();
  });

  it('builds a minimal env with only ARBORESCENT_TERMINAL_ID and ARBORESCENT_NODE_UUID when hookEnv is empty but node UUID is provided', () => {
    const env = buildTerminalEnv('term-5', {}, 'node-uuid-xyz');
    expect(env).toEqual({
      ARBORESCENT_TERMINAL_ID: 'term-5',
      ARBORESCENT_NODE_UUID: 'node-uuid-xyz',
    });
  });

  it('preserves all hookEnv values alongside ARBORESCENT_TERMINAL_ID and ARBORESCENT_NODE_UUID', () => {
    const env = buildTerminalEnv(
      'term-6',
      {
        ARBORESCENT_HOOK_PORT: '8080',
        ARBORESCENT_AUTH_TOKEN: 'secret',
        ARBORESCENT_MCP_PORT: '17840',
        ARBORESCENT_MCP_TOKEN: 'mcp-secret',
      },
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    );

    expect(env).toEqual({
      ARBORESCENT_HOOK_PORT: '8080',
      ARBORESCENT_AUTH_TOKEN: 'secret',
      ARBORESCENT_MCP_PORT: '17840',
      ARBORESCENT_MCP_TOKEN: 'mcp-secret',
      ARBORESCENT_TERMINAL_ID: 'term-6',
      ARBORESCENT_NODE_UUID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
  });

  it('does not mutate the input hookEnv', () => {
    const input = { ARBORESCENT_HOOK_PORT: '17832' };
    const snapshot = { ...input };
    buildTerminalEnv('term-7', input, 'node-uuid');
    expect(input).toEqual(snapshot);
  });
});
