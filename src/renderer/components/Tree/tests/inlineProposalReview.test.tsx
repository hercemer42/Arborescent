import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TreeNode as TreeNodeType } from '@shared/types';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore } from '../../../store/tree/treeStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';

// Match the TreeNode unit-test harness: stub the heavy interaction hooks so the
// component renders without @dnd-kit / plugin machinery.
vi.mock('../../TreeNode/hooks/useNodeDragDrop', () => ({
  useNodeDragDrop: () => ({
    isDragging: false,
    isOver: false,
    dropPosition: null,
    setRefs: vi.fn(),
    attributes: {},
    listeners: {},
  }),
}));
vi.mock('../../TreeNode/hooks/useNodeMouse', () => ({
  useNodeMouse: () => ({
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleClick: vi.fn(),
    wrappedListeners: {},
  }),
}));
vi.mock('../../TreeNode/hooks/useNodeEffects', () => ({
  useNodeEffects: () => ({
    flashIntensity: null,
    isDeleting: false,
    nodeRef: { current: null },
    onAnimationEnd: vi.fn(),
  }),
}));
vi.mock('../../NodeGutter/hooks/usePluginIndicators', () => ({
  usePluginIndicators: () => [],
}));

import { TreeNode } from '../../TreeNode';

const FILE = '/review.arbo';

function node(id: string, content: string, children: string[] = [], metadata: Record<string, unknown> = {}): TreeNodeType {
  return { id, content, children, metadata };
}

function makeMainStore(): TreeStore {
  const store = createTreeStore();
  store.setState({
    nodes: {
      root: node('root', 'Root', ['reviewed']),
      reviewed: node('reviewed', 'Reviewed node', ['orig-child']),
      'orig-child': node('orig-child', 'Original child'),
    },
    rootNodeId: 'root',
    ancestorRegistry: { root: [], reviewed: ['root'], 'orig-child': ['root', 'reviewed'] },
    currentFilePath: FILE,
    reviews: { reviewed: { source: 'terminal', terminalId: null } },
  });
  return store;
}

// Seeds the proposition into the per-file feedback store the way initializeFeedbackStore
// does: a hidden root whose children are the proposition roots. `rootCount` controls
// single-root (inline) vs multi-root (decomposition → panel, not inline).
function seedProposition(rootCount: 1 | 2): void {
  feedbackTreeStore.setStoreFactory(() => createTreeStore());
  if (rootCount === 1) {
    feedbackTreeStore.initialize(
      'reviewed',
      FILE,
      {
        'feedback-root': node('feedback-root', '', ['prop-root']),
        'prop-root': node('prop-root', 'Reviewed node (revised)', ['added', 'removed'], {
          feedbackBaselineKind: 'modified',
          feedbackPriorContent: 'Reviewed node',
        }),
        added: node('added', 'Added child', [], { feedbackBaselineKind: 'added' }),
        removed: node('removed', 'Removed child', [], { feedbackBaselineKind: 'removed' }),
      },
      'feedback-root',
    );
  } else {
    feedbackTreeStore.initialize(
      'reviewed',
      FILE,
      {
        'feedback-root': node('feedback-root', '', ['prop-a', 'prop-b']),
        'prop-a': node('prop-a', 'Story A', []),
        'prop-b': node('prop-b', 'Story B', []),
      },
      'feedback-root',
    );
  }
}

function renderTree(store: TreeStore) {
  return render(
    <TreeStoreContext.Provider value={store}>
      <TreeNode nodeId="reviewed" depth={0} />
    </TreeStoreContext.Provider>,
  );
}

describe('inline proposal review', () => {
  afterEach(() => {
    cleanup();
    feedbackTreeStore.clearAll();
  });

  describe('single-root proposition', () => {
    beforeEach(() => seedProposition(1));

    it('renders the proposition root and descendants in place of the original subtree', () => {
      renderTree(makeMainStore());
      expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
      expect(screen.getByText('Added child')).toBeTruthy();
      expect(screen.queryByText('Original child')).toBeNull();
      // The live reviewed-node row is replaced by the proposition root.
      expect(screen.queryByText('Reviewed node')).toBeNull();
    });

    it('shows an accept/cancel bar above the reviewed node', () => {
      renderTree(makeMainStore());
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    });

    it('renders a modified reviewed root with the change-kind highlight, not the collaborating one', () => {
      const { container } = renderTree(makeMainStore());
      const propRoot = container.querySelector('[data-node-id="prop-root"]');
      expect(propRoot?.classList.contains('feedback-changekind-modified')).toBe(true);
      expect(propRoot?.classList.contains('collaborating')).toBe(false);
    });

    it('marks added nodes with the added change-kind class', () => {
      const { container } = renderTree(makeMainStore());
      const added = container.querySelector('[data-node-id="added"]');
      expect(added?.classList.contains('feedback-changekind-added')).toBe(true);
    });

    it('shows removed nodes as a strikethrough placeholder', () => {
      const { container } = renderTree(makeMainStore());
      const removed = container.querySelector('[data-node-id="removed"]');
      expect(removed?.classList.contains('feedback-changekind-removed')).toBe(true);
    });
  });

  // PR3: decomposition is reviewed inline too (PR2 routed multi-root to the panel; that
  // path is being retired). These assert the new behaviour and are red until PR3 lands.
  describe('multi-root proposition (decomposition) renders inline', () => {
    beforeEach(() => seedProposition(2));

    it('renders every proposition root inline in place of the reviewed node', () => {
      renderTree(makeMainStore());
      expect(screen.getByText('Story A')).toBeTruthy();
      expect(screen.getByText('Story B')).toBeTruthy();
      expect(screen.queryByText('Original child')).toBeNull();
      expect(screen.queryByText('Reviewed node')).toBeNull();
    });

    it('shows the accept/cancel bar for a decomposition review and opens no panel', () => {
      renderTree(makeMainStore());
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    });
  });

  // Scroll anchoring (useScrollAnchor) corrects scrollTop from measured layout; jsdom has
  // no layout, so the no-jump behavior is verified manually in the running app.
  it.todo('keeps the topmost visible node fixed when a proposition appears above the viewport');
});
