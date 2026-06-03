export type BindingOwnerProcess = 'main' | 'renderer';
export type BindingFactRouting = 'authoritative' | 'hint-only';
export type BindingFactScope = 'global' | 'per-file-store';

export interface BindingFactAuthority {
  owner: BindingOwnerProcess;
  store: string;
  scope: BindingFactScope;
  routing: BindingFactRouting;
  sync: string;
}

// The single home for binding-fact ownership. Every binding question has
// exactly one authoritative owner — one owner per fact, not one store: the
// process boundary means main and renderer legitimately own different facts,
// and a cross-process shared registry would put IPC on every resolution.
// Facts marked hint-only are derived copies that no routing decision may
// read directly; they reach routing only by seeding an authoritative store
// or through a liveness-gated check inside a resolver. A new binding fact
// gets its owner assigned here before any resolver may consult it.
export const BINDING_AUTHORITY = {
  'session-to-node': {
    owner: 'main',
    store: 'sessionBindingRegistry',
    scope: 'global',
    routing: 'authoritative',
    sync: 'seeded from node.metadata.sessionId on file open; live conflicts route through pendingRebind/confirmRebind',
  },
  'session-to-terminal': {
    owner: 'renderer',
    store: 'workflowSessionMap',
    scope: 'per-file-store',
    routing: 'authoritative',
    sync: 'runtime-only; captured from SessionStart hook events, never persisted',
  },
  'terminal-to-running-node': {
    owner: 'renderer',
    store: 'terminalNodeAssignments',
    scope: 'per-file-store',
    routing: 'authoritative',
    sync: 'runtime-only; written on workflow launch and advance',
  },
  'terminal-to-origin-node': {
    owner: 'renderer',
    store: 'terminalStore.originNodeId',
    scope: 'global',
    routing: 'hint-only',
    sync: 'persisted with the terminal session; a stale origin with no live session never counts as a binding',
  },
  'persisted-session-hint': {
    owner: 'renderer',
    store: 'node.metadata.sessionId',
    scope: 'per-file-store',
    routing: 'hint-only',
    sync: 'seeds the main registry on file open and is cleared on file close; never read for live routing in main',
  },
} as const satisfies Record<string, BindingFactAuthority>;

export type BindingFactId = keyof typeof BINDING_AUTHORITY;

type FactsOwnedBy<Process extends BindingOwnerProcess> = {
  [Fact in BindingFactId]: (typeof BINDING_AUTHORITY)[Fact]['owner'] extends Process ? Fact : never;
}[BindingFactId];

export type MainBindingFact = FactsOwnedBy<'main'>;
export type RendererBindingFact = FactsOwnedBy<'renderer'>;
