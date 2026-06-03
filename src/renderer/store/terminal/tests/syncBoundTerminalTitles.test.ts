import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '../../../../shared/types';

// resyncBoundTerminalTitles is the post-batch hook for write paths that
// mutate many nodes at once (autonomous AcceptFeedbackCommand apply): instead
// of tracking which node each mutation touched, it re-derives every bound
// terminal title from the settled nodes map. This also covers originNodeId
// migration, where a terminal ends up bound to a different node than the one
// the batch started from.

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useTerminalStore } from '../terminalStore';
import { resyncBoundTerminalTitles } from '../syncBoundTerminalTitles';

const FILE_PATH = '/project.arbo';

function makeNode(id: string, content: string): TreeNode {
  return { id, content, children: [], metadata: {} };
}

type TerminalSeed = { id: string; title: string; originNodeId?: string };

function setTerminals(seeds: TerminalSeed[]): void {
  const terminals = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    cwd: '/tmp',
    originNodeId: s.originNodeId,
  })) as unknown as ReturnType<typeof useTerminalStore.getState>['terminals'];

  useTerminalStore.setState({
    terminals,
    activeTerminalId: seeds[0]?.id ?? null,
    currentFilePath: FILE_PATH,
    fileStates: {
      [FILE_PATH]: {
        terminals,
        activeTerminalId: seeds[0]?.id ?? null,
      },
    },
  });
}

function titleOf(terminalId: string): string | undefined {
  return useTerminalStore.getState().terminals.find((t) => t.id === terminalId)?.title;
}

beforeEach(() => {
  vi.clearAllMocks();
  setTerminals([]);
});

describe('resyncBoundTerminalTitles — re-derivation from a settled nodes map', () => {
  it('re-derives every bound terminal title from its origin node', () => {
    setTerminals([
      { id: 'term-1', title: 'Stale A', originNodeId: 'node-a' },
      { id: 'term-2', title: 'Stale B', originNodeId: 'node-b' },
    ]);

    resyncBoundTerminalTitles({
      'node-a': makeNode('node-a', 'Fresh A\nbody'),
      'node-b': makeNode('node-b', 'Fresh B'),
    });

    expect(titleOf('term-1')).toBe('Fresh A');
    expect(titleOf('term-2')).toBe('Fresh B');
  });

  it('covers originNodeId migration — the title comes from the currently bound node, not the batch origin', () => {
    setTerminals([{ id: 'term-1', title: 'Pre-migration title', originNodeId: 'migrated-output' }]);

    resyncBoundTerminalTitles({
      'old-origin': makeNode('old-origin', 'Old origin content'),
      'migrated-output': makeNode('migrated-output', 'Migrated output title'),
    });

    expect(titleOf('term-1')).toBe('Migrated output title');
  });

  it('ignores terminals without an originNodeId', () => {
    setTerminals([{ id: 'term-1', title: 'Free terminal' }]);

    resyncBoundTerminalTitles({ 'node-a': makeNode('node-a', 'Fresh A') });

    expect(titleOf('term-1')).toBe('Free terminal');
  });

  it('leaves the title untouched when the origin node is missing from the map', () => {
    setTerminals([{ id: 'term-1', title: 'Orphan title', originNodeId: 'deleted-node' }]);

    resyncBoundTerminalTitles({ 'node-a': makeNode('node-a', 'Fresh A') });

    expect(titleOf('term-1')).toBe('Orphan title');
  });

  it('keeps the existing title when the origin node content extracts to empty', () => {
    setTerminals([{ id: 'term-1', title: 'Last good title', originNodeId: 'node-a' }]);

    resyncBoundTerminalTitles({ 'node-a': makeNode('node-a', '   \n\t\n  ') });

    expect(titleOf('term-1')).toBe('Last good title');
  });

  it('produces no terminal-store write when every title is already current (no-op identity)', () => {
    setTerminals([
      { id: 'term-1', title: 'Current A', originNodeId: 'node-a' },
      { id: 'term-2', title: 'Free terminal' },
    ]);

    const before = useTerminalStore.getState().terminals;
    resyncBoundTerminalTitles({ 'node-a': makeNode('node-a', 'Current A\nbody edit only') });
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
  });

  it('an empty nodes map is a safe no-op', () => {
    setTerminals([{ id: 'term-1', title: 'Bound title', originNodeId: 'node-a' }]);

    expect(() => resyncBoundTerminalTitles({})).not.toThrow();
    expect(titleOf('term-1')).toBe('Bound title');
  });

  it('no terminals at all is a safe no-op', () => {
    expect(() => resyncBoundTerminalTitles({ 'node-a': makeNode('node-a', 'Fresh A') })).not.toThrow();
  });
});
