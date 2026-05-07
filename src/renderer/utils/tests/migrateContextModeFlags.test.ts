import { describe, it, expect } from 'vitest';
import { migrateContextModeFlags } from '../migrateContextModeFlags';
import type { TreeNode } from '../../../shared/types';

function ctxNode(id: string, metadata: Record<string, unknown>): TreeNode {
  return {
    id,
    content: 'Context',
    children: [],
    metadata: { isContextDeclaration: true, ...metadata },
  };
}

function plainNode(id: string, metadata: Record<string, unknown> = {}): TreeNode {
  return { id, content: 'Plain', children: [], metadata };
}

describe('migrateContextModeFlags', () => {
  it("legacy 'collaborate' → (collaborate=true, execute=false); legacy field stripped", () => {
    const result = migrateContextModeFlags({
      'a': ctxNode('a', { contextMode: 'collaborate' }),
    });
    expect(result['a'].metadata.collaborate).toBe(true);
    expect(result['a'].metadata.execute).toBe(false);
    expect('contextMode' in result['a'].metadata).toBe(false);
  });

  it("legacy 'execute' → (collaborate=true, execute=true) (behaviour-preserving Both-on); legacy field stripped", () => {
    const result = migrateContextModeFlags({
      'a': ctxNode('a', { contextMode: 'execute' }),
    });
    expect(result['a'].metadata.collaborate).toBe(true);
    expect(result['a'].metadata.execute).toBe(true);
    expect('contextMode' in result['a'].metadata).toBe(false);
  });

  it('legacy contextMode absent on a context declaration → defaults (true, false) applied', () => {
    const result = migrateContextModeFlags({
      'a': ctxNode('a', {}),
    });
    expect(result['a'].metadata.collaborate).toBe(true);
    expect(result['a'].metadata.execute).toBe(false);
  });

  it('unknown contextMode value falls back to defaults, does not crash', () => {
    const result = migrateContextModeFlags({
      'a': ctxNode('a', { contextMode: 'garbage' }),
    });
    expect(result['a'].metadata.collaborate).toBe(true);
    expect(result['a'].metadata.execute).toBe(false);
    expect('contextMode' in result['a'].metadata).toBe(false);
  });

  it('new flags already present → pass through unchanged, idempotent', () => {
    const before = {
      'a': ctxNode('a', { collaborate: false, execute: true }),
    };
    const result = migrateContextModeFlags(before);
    expect(result).toBe(before);
  });

  it('round-trip on already-migrated input is a no-op', () => {
    const first = migrateContextModeFlags({
      'a': ctxNode('a', { contextMode: 'execute' }),
    });
    const second = migrateContextModeFlags(first);
    expect(second).toBe(first);
  });

  it('non-context-declaration nodes are not touched', () => {
    const before = {
      'plain': plainNode('plain'),
      'ctx': ctxNode('ctx', { contextMode: 'collaborate' }),
    };
    const result = migrateContextModeFlags(before);
    expect(result['plain']).toBe(before['plain']);
    expect(result['ctx'].metadata.collaborate).toBe(true);
  });

  it('strips legacy field when both legacy and new flags are present (new flags win)', () => {
    const result = migrateContextModeFlags({
      'a': ctxNode('a', { contextMode: 'execute', collaborate: false, execute: true }),
    });
    expect(result['a'].metadata.collaborate).toBe(false);
    expect(result['a'].metadata.execute).toBe(true);
    expect('contextMode' in result['a'].metadata).toBe(false);
  });
});
