import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcceptFeedbackCommand } from '../AcceptFeedbackCommand';
import { TreeNode } from '../../../../../shared/types';

const { mockTerminals, mockUpdateTerminal } = vi.hoisted(() => ({
  mockTerminals: [] as Array<{ id: string; originNodeId?: string }>,
  mockUpdateTerminal: vi.fn(),
}));

vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      terminals: mockTerminals,
      updateTerminal: mockUpdateTerminal,
    }),
  },
}));

function createNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata };
}

function createState(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>,
) {
  return {
    nodes,
    rootNodeId,
    ancestorRegistry,
    blueprintModeEnabled: false,
    collaboratingNodeId: null as string | null,
    collaborationSource: null as 'browser' | 'terminal' | null,
  };
}

function readGroupId(node: TreeNode | undefined): string | undefined {
  return node?.metadata.groupId as string | undefined;
}

describe('AcceptFeedbackCommand — groupId stamping (decomposition path)', () => {
  let mockState: ReturnType<typeof createState>;
  let getState: () => typeof mockState;
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockTerminals.length = 0;

    mockState = createState(
      {
        root: createNode('root', 'Root', ['parent']),
        parent: createNode('parent', 'Parent', ['source']),
        source: createNode('source', 'Source', [], { sessionId: 'sess-source' }),
      },
      'root',
      {
        root: [],
        parent: ['root'],
        source: ['root', 'parent'],
      },
    );

    getState = vi.fn(() => mockState);
    setState = vi.fn((partial: Partial<typeof mockState>) => {
      Object.assign(mockState, partial);
    });
    triggerAutosave = vi.fn();
  });

  describe('multi-root output (decomposition)', () => {
    it('stamps a fresh groupId on every output tree root', () => {
      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
        'out-c': createNode('out-c', 'Tree C', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b', 'out-c'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B' || n.content === 'Tree C',
      );
      expect(created).toHaveLength(3);

      for (const node of created) {
        expect(readGroupId(node)).toBeDefined();
        expect(typeof readGroupId(node)).toBe('string');
        expect(readGroupId(node)!.length).toBeGreaterThan(0);
      }
    });

    it('all output tree roots from one decomposition share the same groupId', () => {
      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B',
      );
      expect(created).toHaveLength(2);

      const groupIds = created.map(readGroupId);
      expect(groupIds[0]).toBeDefined();
      expect(groupIds[0]).toBe(groupIds[1]);
    });

    it('does not stamp groupId on descendants within an output tree — only on roots', () => {
      const newNodes = {
        'out-a': createNode('out-a', 'Tree A root', ['out-a-child']),
        'out-a-child': createNode('out-a-child', 'Tree A child', []),
        'out-b': createNode('out-b', 'Tree B root', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const childNode = Object.values(stateUpdate.nodes as Record<string, TreeNode>).find(
        (n) => n.content === 'Tree A child',
      );
      expect(childNode).toBeDefined();
      expect(readGroupId(childNode)).toBeUndefined();
    });

    it('does not preserve sessionId from the source onto any output root', () => {
      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B',
      );
      for (const node of created) {
        expect(node.metadata.sessionId).toBeUndefined();
      }
    });

    it('re-decomposition stamps a fresh groupId distinct from the source\'s prior groupId', () => {
      mockState.nodes['source'].metadata = { groupId: 'group-prior', sessionId: 'sess-source' };

      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B',
      );
      for (const node of created) {
        expect(readGroupId(node)).toBeDefined();
        expect(readGroupId(node)).not.toBe('group-prior');
      }
    });

    it('overwrites any groupId that came in on the input newNodesMap (AI-returned payload)', () => {
      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', [], { groupId: 'imported-group-X' }),
        'out-b': createNode('out-b', 'Tree B', [], { groupId: 'imported-group-Y' }),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B',
      );
      const groupIds = created.map(readGroupId);
      expect(groupIds[0]).toBeDefined();
      expect(groupIds[0]).toBe(groupIds[1]);
      expect(groupIds[0]).not.toBe('imported-group-X');
      expect(groupIds[0]).not.toBe('imported-group-Y');
    });

    it('two separate AcceptFeedbackCommand executions produce distinct groupIds', () => {
      mockState.nodes['parent'] = {
        ...mockState.nodes['parent'],
        children: ['source-p', 'source-q'],
      };
      mockState.nodes['source-p'] = createNode('source-p', 'Source P', []);
      mockState.nodes['source-q'] = createNode('source-q', 'Source Q', []);
      mockState.ancestorRegistry['source-p'] = ['root', 'parent'];
      mockState.ancestorRegistry['source-q'] = ['root', 'parent'];
      delete mockState.nodes['source'];
      delete mockState.ancestorRegistry['source'];

      const firstNodes = {
        'p-out-1': createNode('p-out-1', 'P-1', []),
        'p-out-2': createNode('p-out-2', 'P-2', []),
      };
      const secondNodes = {
        'q-out-1': createNode('q-out-1', 'Q-1', []),
        'q-out-2': createNode('q-out-2', 'Q-2', []),
      };

      const cmd1 = new AcceptFeedbackCommand(
        'source-p',
        ['p-out-1', 'p-out-2'],
        firstNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd1.execute();
      const firstUpdate = setState.mock.calls[setState.mock.calls.length - 1][0];

      const cmd2 = new AcceptFeedbackCommand(
        'source-q',
        ['q-out-1', 'q-out-2'],
        secondNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd2.execute();
      const secondUpdate = setState.mock.calls[setState.mock.calls.length - 1][0];

      const pRoots = Object.values(firstUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'P-1' || n.content === 'P-2',
      );
      const qRoots = Object.values(secondUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Q-1' || n.content === 'Q-2',
      );

      const pGroupId = readGroupId(pRoots[0]);
      const qGroupId = readGroupId(qRoots[0]);
      expect(pGroupId).toBeDefined();
      expect(qGroupId).toBeDefined();
      expect(pGroupId).not.toBe(qGroupId);
    });
  });

  describe('multi-root output — sessionId/originNodeId migration to chosen output (AC 5)', () => {
    it('migrates sessionId from source to the first output root when a terminal\'s originNodeId pointed at the source', () => {
      mockTerminals.push({ id: 'term-1', originNodeId: 'source' });

      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B',
      );
      const withSession = created.filter((n) => n.metadata.sessionId === 'sess-source');
      const withoutSession = created.filter((n) => n.metadata.sessionId === undefined);
      expect(withSession).toHaveLength(1);
      expect(withoutSession).toHaveLength(1);
    });

    it('updates the terminal\'s originNodeId to the same output root that now carries the sessionId', () => {
      mockTerminals.push({ id: 'term-1', originNodeId: 'source' });

      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const sessionHolder = Object.values(stateUpdate.nodes as Record<string, TreeNode>).find(
        (n) => n.metadata.sessionId === 'sess-source',
      );
      expect(sessionHolder).toBeDefined();

      expect(mockUpdateTerminal).toHaveBeenCalledWith('term-1', { originNodeId: sessionHolder!.id });
    });

    it('does not migrate sessionId when no terminal pointed at the source', () => {
      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const created = Object.values(stateUpdate.nodes as Record<string, TreeNode>).filter(
        (n) => n.content === 'Tree A' || n.content === 'Tree B',
      );
      for (const node of created) {
        expect(node.metadata.sessionId).toBeUndefined();
      }
      expect(mockUpdateTerminal).not.toHaveBeenCalled();
    });

    it('migrates originNodeId on every terminal that pointed at the source', () => {
      mockTerminals.push({ id: 'term-1', originNodeId: 'source' });
      mockTerminals.push({ id: 'term-2', originNodeId: 'source' });
      mockTerminals.push({ id: 'term-3', originNodeId: 'unrelated' });

      const newNodes = {
        'out-a': createNode('out-a', 'Tree A', []),
        'out-b': createNode('out-b', 'Tree B', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        ['out-a', 'out-b'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const calls = mockUpdateTerminal.mock.calls.map(([id]) => id);
      expect(calls).toEqual(expect.arrayContaining(['term-1', 'term-2']));
      expect(calls).not.toContain('term-3');
    });
  });

  describe('single-root output (in-place refinement, not decomposition)', () => {
    it('does not stamp a groupId on the in-place-replaced node (single-root path is not a decomposition)', () => {
      const newNodes = {
        'replacement': createNode('replacement', 'Refined content', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        'replacement',
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const result = stateUpdate.nodes['source'];
      expect(result).toBeDefined();
      expect(readGroupId(result)).toBeUndefined();
    });

    it('re-stamps the source sessionId on the in-place-replaced node so the terminal binding survives refinement', () => {
      const newNodes = {
        'replacement': createNode('replacement', 'Refined content', []),
      };

      const cmd = new AcceptFeedbackCommand(
        'source',
        'replacement',
        newNodes,
        getState,
        setState,
        triggerAutosave,
      );
      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      const result = stateUpdate.nodes['source'];
      expect(result.metadata.sessionId).toBe('sess-source');
    });
  });
});
