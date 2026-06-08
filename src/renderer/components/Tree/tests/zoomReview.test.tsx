import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TreeNode as TreeNodeType } from '@shared/types';
import { Tree } from '../Tree';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore } from '../../../store/tree/treeStore';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';

// Tree renders TreeNode subtrees; stub the heavy interaction hooks so we exercise the
// zoom + review render path without @dnd-kit / plugin machinery. Mirrors the
// inlineProposalReview harness so the two review-render tests stay consistent.
vi.mock('../hooks/useTree', () => ({ useTree: vi.fn() }));
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

const FILE = '/review.arbo';

function node(id: string, content: string, children: string[] = [], metadata: Record<string, unknown> = {}): TreeNodeType {
  return { id, content, children, metadata };
}

// A main store whose `reviewed` node is under review and reachable as a zoom root, plus a
// `plain` node that is not. `reviewedChildren` lets a test make the reviewed node a leaf
// (no live children) to exercise the displayChildren early-return.
function makeMainStore(reviewedChildren: string[] = ['orig-child']): TreeStore {
  const store = createTreeStore();
  store.setState({
    nodes: {
      root: node('root', 'Root', ['reviewed', 'plain']),
      reviewed: node('reviewed', 'Reviewed node', reviewedChildren),
      'orig-child': node('orig-child', 'Original child'),
      plain: node('plain', 'Plain node', ['plain-child']),
      'plain-child': node('plain-child', 'Plain child'),
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      root: [],
      reviewed: ['root'],
      'orig-child': ['root', 'reviewed'],
      plain: ['root'],
      'plain-child': ['root', 'plain'],
    },
    currentFilePath: FILE,
    reviews: { reviewed: { source: 'terminal', terminalId: null } },
  });
  return store;
}

// Seeds the proposition into the per-file feedback store the way initializeFeedbackStore
// does: a hidden root whose children are the proposition roots. `rootCount` controls
// single-root (modified node) vs multi-root (decomposition).
function seedProposition(rootCount: 1 | 2): void {
  feedbackTreeStore.setStoreFactory(() => createTreeStore());
  if (rootCount === 1) {
    feedbackTreeStore.initialize(
      'reviewed',
      FILE,
      {
        'feedback-root': node('feedback-root', '', ['prop-root']),
        'prop-root': node('prop-root', 'Reviewed node (revised)', ['added'], {
          feedbackBaselineKind: 'modified',
          feedbackPriorContent: 'Reviewed node',
        }),
        added: node('added', 'Added child', [], { feedbackBaselineKind: 'added' }),
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

// A reviewed node nested under a not-under-review ancestor, so a test can zoom into the
// ancestor and confirm the descendant's proposition still renders via normal recursion.
function makeNestedReviewStore(): TreeStore {
  const store = createTreeStore();
  store.setState({
    nodes: {
      root: node('root', 'Root', ['ancestor']),
      ancestor: node('ancestor', 'Ancestor', ['reviewed']),
      reviewed: node('reviewed', 'Reviewed node', ['orig-child']),
      'orig-child': node('orig-child', 'Original child'),
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      root: [],
      ancestor: ['root'],
      reviewed: ['root', 'ancestor'],
      'orig-child': ['root', 'ancestor', 'reviewed'],
    },
    currentFilePath: FILE,
    reviews: { reviewed: { source: 'terminal', terminalId: null } },
  });
  return store;
}

function renderZoomed(store: TreeStore, zoomedNodeId?: string) {
  return render(
    <TreeStoreContext.Provider value={store}>
      <Tree zoomedNodeId={zoomedNodeId} />
    </TreeStoreContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  feedbackTreeStore.clearAll();
});

describe('zoom on a node under review', () => {
  describe('single-root proposition', () => {
    it('renders the review proposition in place of the zoomed node\'s live subtree', () => {
      seedProposition(1);
      renderZoomed(makeMainStore(), 'reviewed');
      expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
      expect(screen.getByText('Added child')).toBeTruthy();
      // the live child is replaced by the proposition, not shown alongside it
      expect(screen.queryByText('Original child')).toBeNull();
    });

    it('shows the accept/cancel control bar when zoomed into the reviewed node', () => {
      seedProposition(1);
      renderZoomed(makeMainStore(), 'reviewed');
      // exposed as a labelled group so assistive tech announces the review controls
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    });

    it('marks the proposition region with the reviewed node id so keyboard focus resolves to its store', () => {
      seedProposition(1);
      const { container } = renderZoomed(makeMainStore(), 'reviewed');
      const region = container.querySelector('[data-review-proposition]');
      expect(region?.getAttribute('data-review-proposition')).toBe('reviewed');
    });

    it('applies per-node change-kind highlighting to the zoomed proposition', () => {
      seedProposition(1);
      const { container } = renderZoomed(makeMainStore(), 'reviewed');
      const propRoot = container.querySelector('[data-node-id="prop-root"]');
      const added = container.querySelector('[data-node-id="added"]');
      expect(propRoot?.classList.contains('feedback-changekind-modified')).toBe(true);
      expect(added?.classList.contains('feedback-changekind-added')).toBe(true);
    });
  });

  describe('multi-root decomposition proposition', () => {
    it('renders every proposition root and the control bar when zoomed into the reviewed node', () => {
      seedProposition(2);
      renderZoomed(makeMainStore(), 'reviewed');
      expect(screen.getByText('Story A')).toBeTruthy();
      expect(screen.getByText('Story B')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    });
  });

  describe('reviewed leaf with no live children', () => {
    it('still renders the proposition and control bar even though the zoom root has no live children', () => {
      seedProposition(1);
      renderZoomed(makeMainStore([]), 'reviewed');
      expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    });
  });

  // The eventual UX once accept/cancel resolves a review from a zoom tab (the zoom target
  // may be restructured or removed, leaving zoomedNodeId dangling) is still an open design
  // decision in the spec — title-only until that behaviour is settled.
  it.todo('keeps the zoom tab coherent after the review is accepted or cancelled from the zoom root');
});

describe('zoom into an ancestor of a reviewed descendant', () => {
  it('renders the reviewed descendant proposition via normal recursion when zooming a not-under-review ancestor', () => {
    seedProposition(1);
    renderZoomed(makeNestedReviewStore(), 'ancestor');
    expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    // the descendant's live child is replaced by its proposition, same as inline review
    expect(screen.queryByText('Original child')).toBeNull();
  });
});

describe('zoom that must not change behaviour', () => {
  it('renders only the children of a normal (not-under-review) zoom root, with no review controls', () => {
    renderZoomed(makeMainStore(), 'plain');
    expect(screen.getByText('Plain child')).toBeTruthy();
    // the zoom root's own row stays hidden for a normal node (existing zoom design)
    expect(screen.queryByText('Plain node')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Review proposed changes' })).toBeNull();
  });

  it('renders nothing without throwing when the zoom target node does not exist', () => {
    const { container } = renderZoomed(makeMainStore(), 'missing-node');
    expect(container.firstChild).toBeNull();
  });
});
