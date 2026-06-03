import { describe, it, expect } from 'vitest';
import {
  BINDING_AUTHORITY,
  type BindingFactId,
  type BindingFactAuthority,
} from '../bindingAuthority';

// Pins the shared binding-authority table contract — the single place a
// binding fact gets an owner assigned (MODE_POLICY precedent). One
// authoritative owner per fact, not one store: main and renderer
// legitimately own different facts, and derived copies are demoted to
// hints that no routing decision may read.

const ALL_FACTS: BindingFactId[] = [
  'session-to-node',
  'session-to-terminal',
  'terminal-to-running-node',
  'terminal-to-origin-node',
  'persisted-session-hint',
];

describe('BINDING_AUTHORITY — fact enumeration', () => {
  it('enumerates exactly the five binding facts, no more, no fewer', () => {
    expect(Object.keys(BINDING_AUTHORITY).sort()).toEqual([...ALL_FACTS].sort());
  });

  it('every fact declares an owner, a store, a scope, a routing role, and a sync mechanism', () => {
    for (const fact of ALL_FACTS) {
      const entry: BindingFactAuthority = BINDING_AUTHORITY[fact];
      expect(entry.owner === 'main' || entry.owner === 'renderer').toBe(true);
      expect(entry.store.length).toBeGreaterThan(0);
      expect(entry.scope === 'global' || entry.scope === 'per-file-store').toBe(true);
      expect(entry.routing === 'authoritative' || entry.routing === 'hint-only').toBe(true);
      expect(entry.sync.length).toBeGreaterThan(0);
    }
  });
});

describe('BINDING_AUTHORITY — per-fact ownership', () => {
  it('session-to-node is owned by main via the sessionBindingRegistry and is authoritative', () => {
    const entry = BINDING_AUTHORITY['session-to-node'];
    expect(entry.owner).toBe('main');
    expect(entry.store).toBe('sessionBindingRegistry');
    expect(entry.routing).toBe('authoritative');
    expect(entry.scope).toBe('global');
  });

  it('session-to-terminal is owned by the renderer via workflowSessionMap, scoped per file store', () => {
    const entry = BINDING_AUTHORITY['session-to-terminal'];
    expect(entry.owner).toBe('renderer');
    expect(entry.store).toBe('workflowSessionMap');
    expect(entry.routing).toBe('authoritative');
    expect(entry.scope).toBe('per-file-store');
  });

  it('terminal-to-running-node is owned by the renderer via terminalNodeAssignments and is authoritative', () => {
    const entry = BINDING_AUTHORITY['terminal-to-running-node'];
    expect(entry.owner).toBe('renderer');
    expect(entry.store).toBe('terminalNodeAssignments');
    expect(entry.routing).toBe('authoritative');
  });

  it('terminal-to-origin-node is hint-only — a stale originNodeId with no live session never counts as a binding', () => {
    const entry = BINDING_AUTHORITY['terminal-to-origin-node'];
    expect(entry.owner).toBe('renderer');
    expect(entry.store).toBe('terminalStore.originNodeId');
    expect(entry.routing).toBe('hint-only');
  });

  it('persisted-session-hint (node.metadata.sessionId) is hint-only and syncs by seeding the registry on file open', () => {
    const entry = BINDING_AUTHORITY['persisted-session-hint'];
    expect(entry.store).toBe('node.metadata.sessionId');
    expect(entry.routing).toBe('hint-only');
    expect(entry.sync).toContain('seed');
  });
});

describe('BINDING_AUTHORITY — cross-process invariants', () => {
  it('main owns exactly one fact (session-to-node) — main keeps no copy of session-to-terminal', () => {
    const mainOwned = ALL_FACTS.filter((fact) => BINDING_AUTHORITY[fact].owner === 'main');
    expect(mainOwned).toEqual(['session-to-node']);
  });

  it('exactly three facts are routing-authoritative; the two derived copies are hint-only', () => {
    const authoritative = ALL_FACTS.filter(
      (fact) => BINDING_AUTHORITY[fact].routing === 'authoritative',
    ).sort();
    expect(authoritative).toEqual(
      ['session-to-node', 'session-to-terminal', 'terminal-to-running-node'].sort(),
    );
  });

  it('no two authoritative facts share a store — one owner per fact, not one store', () => {
    const stores = ALL_FACTS.filter(
      (fact) => BINDING_AUTHORITY[fact].routing === 'authoritative',
    ).map((fact) => BINDING_AUTHORITY[fact].store);
    expect(new Set(stores).size).toBe(stores.length);
  });
});
