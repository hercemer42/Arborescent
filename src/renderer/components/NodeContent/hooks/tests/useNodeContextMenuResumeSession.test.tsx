import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';

function createMockContextMenuEvent(x: number, y: number) {
  const mockContentEditable = document.createElement('div');
  mockContentEditable.className = 'node-text';
  mockContentEditable.textContent = 'Step';

  const mockWrapper = document.createElement('div');
  mockWrapper.appendChild(mockContentEditable);

  return {
    preventDefault: vi.fn(),
    clientX: x,
    clientY: y,
    currentTarget: mockWrapper,
  } as unknown as React.MouseEvent;
}

async function openContextMenu(result: { current: ReturnType<typeof useNodeContextMenu> }) {
  vi.useFakeTimers();
  const mockEvent = createMockContextMenuEvent(100, 200);
  await act(async () => {
    void result.current.handleContextMenu(mockEvent);
    await vi.advanceTimersByTimeAsync(550);
  });
  vi.useRealTimers();
}

const stepNode: TreeNode = {
  id: 'step-1',
  content: 'Step 1',
  children: [],
  metadata: { isWorkflow: true, stepType: 'manual', sessionId: 'session-abc' },
};

const baseNodes: Record<string, TreeNode> = {
  root: { id: 'root', content: 'Root', children: ['step-1'], metadata: {} },
  'step-1': stepNode,
};

const baseAncestors = {
  root: [],
  'step-1': ['root'],
};

function seedStore(workflowSessionMap: Record<string, string>): TreeStore {
  const store = createTreeStore();
  store.setState({
    nodes: baseNodes,
    rootNodeId: 'root',
    activeNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    ancestorRegistry: baseAncestors,
    workflowSessionMap,
    actions: {
      deleteNode: vi.fn(),
      copyNodes: vi.fn(),
      cutNodes: vi.fn(),
      pasteNodes: vi.fn(),
      toggleNodeSelection: vi.fn(),
      selectNode: vi.fn(),
      clearSelection: vi.fn(),
      setRememberedVisualX: vi.fn(),
      resumeSession: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  return store;
}

describe('useNodeContextMenu — Resume session entry gating', () => {
  let store: TreeStore;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('hides "Resume session" when the node has sessionId AND liveness is alive-attached', async () => {
    store = seedStore({ 'session-abc': 'terminal-x' });

    const { result } = renderHook(() => useNodeContextMenu(stepNode), { wrapper });
    await openContextMenu(result);

    const resumeItem = result.current.contextMenuItems.find(item => item.label === 'Resume session');
    expect(resumeItem).toBeUndefined();
  });

  it('shows "Resume session" when the node has sessionId AND liveness is alive-detached', async () => {
    store = seedStore({});

    const { result } = renderHook(() => useNodeContextMenu(stepNode), { wrapper });
    await openContextMenu(result);

    const resumeItem = result.current.contextMenuItems.find(item => item.label === 'Resume session');
    expect(resumeItem).toBeDefined();
  });

  it('hides "Resume session" when the node has no sessionId at all', async () => {
    store = seedStore({});
    const noSessionNode: TreeNode = {
      ...stepNode,
      metadata: { isWorkflow: true, stepType: 'manual' },
    };
    store.setState({
      nodes: { ...baseNodes, 'step-1': noSessionNode },
    });

    const { result } = renderHook(() => useNodeContextMenu(noSessionNode), { wrapper });
    await openContextMenu(result);

    const resumeItem = result.current.contextMenuItems.find(item => item.label === 'Resume session');
    expect(resumeItem).toBeUndefined();
  });

  it.todo('hides "Resume session" on non-workflow nodes regardless of metadata');
  it.todo('gating uses session liveness, not workflow execution state — a stopped workflow with alive session still shows resume');
});

describe('useNodeContextMenu — Resume session click behavior (PR1)', () => {
  it.todo('clicking "Resume session" when liveness is alive-detached opens a new terminal tab in the recorded working directory');
  it.todo('clicking "Resume session" emits the resume command with the correct sessionId and cwd');
  it.todo('clicking "Resume session" surfaces a toast when the focus/open call rejects');
  it.todo('clicking "Resume session" on a stale node whose session just died shows "session lost" toast and refreshes the menu');
});

describe('useNodeContextMenu — session-lost indicator (PR1)', () => {
  it.todo('a node with sessionId and liveness=alive-detached is rendered with the "session lost" indicator');
  it.todo('the indicator clears once the node is restarted with a fresh session');
});

describe('useNodeContextMenu — independence between parallel sessions (PR1)', () => {
  it.todo('Resume session on node A does not surface or affect node B\'s tab when both have live-detached sessions');
  it.todo('two nodes with different alive-detached sessions each get their own working "Resume session" entry');
});

describe('useNodeContextMenu — accessibility (PR1)', () => {
  it.todo('the "Resume session" entry is keyboard-reachable in the context menu');
  it.todo('the session-lost indicator carries an accessible label / aria attribute');
});
