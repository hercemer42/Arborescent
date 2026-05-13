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

vi.mock('../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

import { useTerminalStore, type TerminalInfo } from '../terminalStore';
import type { TreeNode } from '../../../../shared/types';

function makeTerminal(overrides: Partial<TerminalInfo> = {}): TerminalInfo {
  return {
    id: 'terminal-1',
    title: 'Terminal 1',
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
    ...overrides,
  };
}

function makeNode(id: string, content: string): TreeNode {
  return { id, content, children: [], metadata: {} } as unknown as TreeNode;
}

describe('terminal tab title reflects the dispatched task', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTerminalSession.mockResolvedValue(null);
    mockCreateTerminal.mockImplementation((title: string) =>
      Promise.resolve(makeTerminal({ id: 'created-terminal', title })),
    );
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: '/test/file.arbo',
      fileStates: { '/test/file.arbo': { terminals: [], activeTerminalId: null } },
    });
    (window.electron.terminalWrite as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe('sendNodeToTerminal', () => {
    it('updates the active terminal title to the dispatched task title', async () => {
      const existing = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      useTerminalStore.setState({
        terminals: [existing],
        activeTerminalId: 'terminal-1',
        fileStates: {
          '/test/file.arbo': { terminals: [existing], activeTerminalId: 'terminal-1' },
        },
      });

      const node = makeNode('node-A', 'Replace terminal tab name with current task title');
      await useTerminalStore.getState().sendNodeToTerminal(node, { 'node-A': node });

      const updated = useTerminalStore.getState().terminals.find((t) => t.id === 'terminal-1');
      expect(updated?.title).toBe('Replace terminal tab name with current task title');
    });

    it('updates the title on each subsequent send to the same terminal (per-task, not per-session)', async () => {
      const existing = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      useTerminalStore.setState({
        terminals: [existing],
        activeTerminalId: 'terminal-1',
        fileStates: {
          '/test/file.arbo': { terminals: [existing], activeTerminalId: 'terminal-1' },
        },
      });

      const first = makeNode('node-A', 'First task');
      await useTerminalStore.getState().sendNodeToTerminal(first, { 'node-A': first });

      const second = makeNode('node-B', 'Second task');
      await useTerminalStore.getState().sendNodeToTerminal(second, { 'node-B': second });

      const updated = useTerminalStore.getState().terminals.find((t) => t.id === 'terminal-1');
      expect(updated?.title).toBe('Second task');
    });

    it('sets the title on a freshly created terminal when none is active', async () => {
      const node = makeNode('node-A', 'Fresh task');
      await useTerminalStore.getState().sendNodeToTerminal(node, { 'node-A': node });

      const created = useTerminalStore.getState().terminals[0];
      expect(created?.title).toBe('Fresh task');
    });

    it('does not blank the existing tab title when the node content is empty', async () => {
      const existing = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      useTerminalStore.setState({
        terminals: [existing],
        activeTerminalId: 'terminal-1',
        fileStates: {
          '/test/file.arbo': { terminals: [existing], activeTerminalId: 'terminal-1' },
        },
      });

      const empty = makeNode('node-A', '   ');
      await useTerminalStore.getState().sendNodeToTerminal(empty, { 'node-A': empty });

      const updated = useTerminalStore.getState().terminals.find((t) => t.id === 'terminal-1');
      expect(updated?.title).toBe('Terminal 1');
    });

    it('updates only the receiving terminal, not other tabs', async () => {
      const a = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      const b = makeTerminal({ id: 'terminal-2', title: 'Terminal 2' });
      useTerminalStore.setState({
        terminals: [a, b],
        activeTerminalId: 'terminal-2',
        fileStates: {
          '/test/file.arbo': { terminals: [a, b], activeTerminalId: 'terminal-2' },
        },
      });

      const node = makeNode('node-A', 'Only update terminal 2');
      await useTerminalStore.getState().sendNodeToTerminal(node, { 'node-A': node });

      const terminals = useTerminalStore.getState().terminals;
      expect(terminals.find((t) => t.id === 'terminal-1')?.title).toBe('Terminal 1');
      expect(terminals.find((t) => t.id === 'terminal-2')?.title).toBe('Only update terminal 2');
    });
  });

  describe('executeNodeInTerminal', () => {
    beforeEach(() => {
      const mockTextarea = document.createElement('textarea');
      vi.spyOn(document, 'querySelector').mockReturnValue(mockTextarea);
    });

    it('updates the active terminal title to the dispatched task title', async () => {
      const existing = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      useTerminalStore.setState({
        terminals: [existing],
        activeTerminalId: 'terminal-1',
        fileStates: {
          '/test/file.arbo': { terminals: [existing], activeTerminalId: 'terminal-1' },
        },
      });

      const node = makeNode('node-A', 'Run this task');
      await useTerminalStore.getState().executeNodeInTerminal(node, { 'node-A': node });

      const updated = useTerminalStore.getState().terminals.find((t) => t.id === 'terminal-1');
      expect(updated?.title).toBe('Run this task');
    });

    it('does not blank the existing tab title when the node content is empty', async () => {
      const existing = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      useTerminalStore.setState({
        terminals: [existing],
        activeTerminalId: 'terminal-1',
        fileStates: {
          '/test/file.arbo': { terminals: [existing], activeTerminalId: 'terminal-1' },
        },
      });

      const empty = makeNode('node-A', '');
      await useTerminalStore.getState().executeNodeInTerminal(empty, { 'node-A': empty });

      const updated = useTerminalStore.getState().terminals.find((t) => t.id === 'terminal-1');
      expect(updated?.title).toBe('Terminal 1');
    });

    it('sets the title on a freshly created terminal when none is active', async () => {
      const node = makeNode('node-A', 'Fresh execute task');
      await useTerminalStore.getState().executeNodeInTerminal(node, { 'node-A': node });

      const created = useTerminalStore.getState().terminals[0];
      expect(created?.title).toBe('Fresh execute task');
    });
  });

  describe('failure semantics', () => {
    it('does not throw when terminalWrite rejects, even after the title has been updated', async () => {
      const existing = makeTerminal({ id: 'terminal-1', title: 'Terminal 1' });
      useTerminalStore.setState({
        terminals: [existing],
        activeTerminalId: 'terminal-1',
        fileStates: {
          '/test/file.arbo': { terminals: [existing], activeTerminalId: 'terminal-1' },
        },
      });
      (window.electron.terminalWrite as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('write failed');
      });

      const node = makeNode('node-A', 'Task that fails to write');
      await expect(
        useTerminalStore.getState().sendNodeToTerminal(node, { 'node-A': node }),
      ).resolves.toBeUndefined();
    });

    it('leaves the tab title at the terminal default when terminal creation fails', async () => {
      mockCreateTerminal.mockImplementation(() => Promise.reject(new Error('boom')));

      const node = makeNode('node-A', 'Task we never get to dispatch');
      await useTerminalStore.getState().sendNodeToTerminal(node, { 'node-A': node });

      expect(useTerminalStore.getState().terminals).toHaveLength(0);
      expect(useTerminalStore.getState().activeTerminalId).toBeNull();
    });
  });
});
