import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, sep } from 'path';

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { resolveBinding, CONSULTED_BINDING_FACTS } from '../bindingResolution';
import { BINDING_AUTHORITY } from '../../../shared/utils/bindingAuthority';

// Main's sessionBindingRegistry is the sole authority for session→node.
// Deleting a bound node and rebinding the terminal leaves
// node.metadata.sessionId stale on the old node — routing must follow the
// registry, and nothing in the main process may consult node metadata to
// answer which node owns a session.

const SESSION = 'session-1';
const NODE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const NODE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

describe('drift regression — delete bound node, rebind terminal, registry wins', () => {
  let registry: SessionBindingRegistry;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
  });

  it('after the bound node is deleted and the terminal rebound, resolution follows the new registry binding', () => {
    registry.register(SESSION, NODE_A);
    // Node A deleted — its binding is unregistered, while A's persisted
    // metadata.sessionId (not visible to main) stays stale on disk.
    registry.unregister(SESSION);
    registry.register(SESSION, NODE_B);

    const resolved = resolveBinding({ bindingRegistry: registry }, SESSION, { oneShot: false });

    expect(resolved).toEqual({ nodeId: NODE_B, source: 'workflow' });
  });

  it('a rebind without prior unregister stays on the old node until confirmed — no silent overwrite', () => {
    registry.register(SESSION, NODE_A);
    const result = registry.register(SESSION, NODE_B);

    expect(result?.kind).toBe('rebind-needed');
    expect(resolveBinding({ bindingRegistry: registry }, SESSION, { oneShot: false }))
      .toEqual({ nodeId: NODE_A, source: 'workflow' });
  });

  it('confirming the rebind moves resolution to the new node', () => {
    registry.register(SESSION, NODE_A);
    registry.register(SESSION, NODE_B);
    registry.confirmRebind(SESSION);

    expect(resolveBinding({ bindingRegistry: registry }, SESSION, { oneShot: false }))
      .toEqual({ nodeId: NODE_B, source: 'workflow' });
  });

  it('a deleted binding with no rebind resolves to null — stale state never resurrects a binding', () => {
    registry.register(SESSION, NODE_A);
    registry.unregister(SESSION);

    expect(resolveBinding({ bindingRegistry: registry }, SESSION, { oneShot: false })).toBeNull();
  });

  it('an empty sessionId never resolves', () => {
    registry.register(SESSION, NODE_A);

    expect(resolveBinding({ bindingRegistry: registry }, '', { oneShot: false })).toBeNull();
  });

  it('resolution consults only the registry — a deps object exposing nothing but lookup is sufficient', () => {
    const lookupOnly = { lookup: (sessionId: string) => (sessionId === SESSION ? NODE_B : null) };

    const resolved = resolveBinding({ bindingRegistry: lookupOnly }, SESSION, { oneShot: false });

    expect(resolved).toEqual({ nodeId: NODE_B, source: 'workflow' });
  });
});

describe('authority table consumption — resolver read set comes from BINDING_AUTHORITY', () => {
  it('the main resolver consults exactly the one fact the table assigns to main', () => {
    expect([...CONSULTED_BINDING_FACTS]).toEqual(['session-to-node']);
  });

  it('every consulted fact is main-owned and routing-authoritative per the table', () => {
    for (const fact of CONSULTED_BINDING_FACTS) {
      expect(BINDING_AUTHORITY[fact].owner).toBe('main');
      expect(BINDING_AUTHORITY[fact].routing).toBe('authoritative');
    }
  });
});

describe('metadata demotion audit — no main-process routing read of node.metadata.sessionId', () => {
  it('no non-test main-process source reads metadata.sessionId', () => {
    const mainDir = join(__dirname, '..', '..');
    const offenders = readdirSync(mainDir, { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.ts') && !name.split(sep).includes('tests'))
      .filter((name) => {
        const source = readFileSync(join(mainDir, name), 'utf8');
        return source.includes('metadata.sessionId') || source.includes('metadata?.sessionId');
      });

    expect(offenders).toEqual([]);
  });
});
