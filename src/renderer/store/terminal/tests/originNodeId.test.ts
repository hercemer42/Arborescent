import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSaveTerminalSession, mockGetTerminalSession, mockCreateTerminal } = vi.hoisted(() => ({
  mockSaveTerminalSession: vi.fn(),
  mockGetTerminalSession: vi.fn().mockResolvedValue(null),
  mockCreateTerminal: vi.fn(),
}));

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: mockCreateTerminal,
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: mockSaveTerminalSession,
    getTerminalSession: mockGetTerminalSession,
  })),
}));

import { useTerminalStore, type TerminalInfo } from '../terminalStore';
import type { TreeNode } from '../../../../shared/types';

function makeTerminal(overrides: Partial<TerminalInfo> = {}): TerminalInfo {
  return {
    id: 'terminal-1',
    title: 'Terminal',
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
    ...overrides,
  };
}

function makeNode(id: string, content = 'echo hi'): TreeNode {
  return { id, content, children: [], metadata: {} } as unknown as TreeNode;
}

describe('terminal originNodeId association', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTerminalSession.mockResolvedValue(null);
    mockCreateTerminal.mockImplementation((title: string) =>
      Promise.resolve(
        makeTerminal({ id: `new-${Math.random().toString(36).slice(2)}`, title }),
      ),
    );
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: '/test/file.arbo',
      fileStates: {},
    });
    window.electron = {
      ...window.electron,
      terminalWrite: vi.fn().mockResolvedValue(undefined),
      terminalDestroy: vi.fn().mockResolvedValue(undefined),
      terminalGetCwd: vi.fn().mockResolvedValue('/home/user'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('TerminalInfo durable origin field', () => {
    it('addTerminal stores originNodeId when provided', () => {
      useTerminalStore.getState().addTerminal(
        makeTerminal({ id: 'term-1', originNodeId: 'node-origin' }),
      );

      expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('node-origin');
    });

    it('addTerminal leaves originNodeId undefined when not provided', () => {
      useTerminalStore.getState().addTerminal(makeTerminal({ id: 'term-1' }));

      expect(useTerminalStore.getState().terminals[0].originNodeId).toBeUndefined();
    });

    it('createNewTerminal accepts an originNodeId and stores it on the resulting terminal', async () => {
      const terminal = await useTerminalStore.getState().createNewTerminal(
        'Terminal',
        '/tmp',
        'node-origin',
      );

      expect(terminal).not.toBeNull();
      expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('node-origin');
    });
  });

  describe('node-initiated terminal openings record the origin', () => {
    it('sendNodeToTerminal records originNodeId on the auto-created terminal', async () => {
      const node = makeNode('node-origin');

      await useTerminalStore.getState().sendNodeToTerminal(node, { 'node-origin': node });

      expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('node-origin');
    });

    it('executeNodeInTerminal records originNodeId on the auto-created terminal', async () => {
      const mockTextarea = document.createElement('textarea');
      vi.spyOn(document, 'querySelector').mockReturnValue(mockTextarea);
      const node = makeNode('node-origin');

      await useTerminalStore.getState().executeNodeInTerminal(node, { 'node-origin': node });

      expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('node-origin');
    });

    it('sendNodeToTerminal does NOT overwrite an existing terminal’s origin (origin-on-create policy)', async () => {
      useTerminalStore.getState().addTerminal(
        makeTerminal({ id: 'existing-terminal', originNodeId: 'node-first' }),
      );
      const node = makeNode('node-second');

      await useTerminalStore.getState().sendNodeToTerminal(node, { 'node-second': node });

      const stored = useTerminalStore.getState().terminals.find((t) => t.id === 'existing-terminal');
      expect(stored?.originNodeId).toBe('node-first');
    });
  });

  describe('origin survives common lifecycle events', () => {
    it('keeps the origin across setActiveFile transitions', () => {
      useTerminalStore.getState().setActiveFile('/file-a.arbo');
      useTerminalStore.getState().addTerminal(
        makeTerminal({ id: 'term-a', originNodeId: 'node-A' }),
      );

      useTerminalStore.getState().setActiveFile('/file-b.arbo');
      useTerminalStore.getState().setActiveFile('/file-a.arbo');

      const stored = useTerminalStore.getState().terminals.find((t) => t.id === 'term-a');
      expect(stored?.originNodeId).toBe('node-A');
    });

    it('updateTerminal does not silently drop originNodeId when other fields change', () => {
      useTerminalStore.getState().setActiveFile('/file-a.arbo');
      useTerminalStore.getState().addTerminal(
        makeTerminal({ id: 'term-1', originNodeId: 'node-A' }),
      );

      useTerminalStore.getState().updateTerminal('term-1', { title: 'Renamed' });

      const stored = useTerminalStore.getState().terminals[0];
      expect(stored.originNodeId).toBe('node-A');
      expect(stored.title).toBe('Renamed');
    });

    it('removing the terminal clears any association — the entry is gone', async () => {
      useTerminalStore.getState().setActiveFile('/file-a.arbo');
      useTerminalStore.getState().addTerminal(
        makeTerminal({ id: 'term-1', originNodeId: 'node-A' }),
      );

      await useTerminalStore.getState().closeTerminal('term-1');

      expect(useTerminalStore.getState().terminals.find((t) => t.id === 'term-1')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles a node with an empty id without throwing and does not record an empty origin', async () => {
      const node = makeNode('');

      await useTerminalStore.getState().sendNodeToTerminal(node, { '': node });

      expect(useTerminalStore.getState().terminals[0].originNodeId).toBeUndefined();
    });

    it('repeatedly sending different nodes to the same terminal preserves the first origin', async () => {
      const first = makeNode('node-first');
      const second = makeNode('node-second');
      const third = makeNode('node-third');

      await useTerminalStore.getState().sendNodeToTerminal(first, { 'node-first': first });
      await useTerminalStore.getState().sendNodeToTerminal(second, { 'node-second': second });
      await useTerminalStore.getState().sendNodeToTerminal(third, { 'node-third': third });

      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('node-first');
    });
  });
});
