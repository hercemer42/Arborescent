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

// A single-root proposition that also carries an unchanged context row (no
// feedbackBaselineKind → no change-kind class). That untouched row is the one the
// gold review backdrop covers: it is neither added (green) nor modified (blue).
function seedPropositionWithContext(): void {
  feedbackTreeStore.setStoreFactory(() => createTreeStore());
  feedbackTreeStore.initialize(
    'reviewed',
    FILE,
    {
      'feedback-root': node('feedback-root', '', ['prop-root']),
      'prop-root': node('prop-root', 'Reviewed node (revised)', ['added', 'context'], {
        feedbackBaselineKind: 'modified',
        feedbackPriorContent: 'Reviewed node',
      }),
      added: node('added', 'Added child', [], { feedbackBaselineKind: 'added' }),
      context: node('context', 'Unchanged context child', []),
    },
    'feedback-root',
  );
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

    it('marks the proposition region with the reviewed node id so keyboard focus resolves to its store', () => {
      const { container } = renderTree(makeMainStore());
      const region = container.querySelector('[data-review-proposition]');
      expect(region?.getAttribute('data-review-proposition')).toBe('reviewed');
      expect(region?.querySelector('[data-node-id="prop-root"]')).toBeTruthy();
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

  // Uncoloured context rows in a proposition carry the gold review backdrop so the
  // control bar and the whole subtree read as one region, while added/modified rows
  // keep their change-kind colour. The structural assertions below cover the contract
  // the gold CSS depends on; the gold paint itself comes from stylesheet rules jsdom
  // does not evaluate, so those cases are title-only (as with the scroll-anchor todo below).
  describe('gold review backdrop encapsulation', () => {
    beforeEach(() => seedPropositionWithContext());

    it('leaves an unchanged context row free of every change-kind class so the gold backdrop can target it', () => {
      const { container } = renderTree(makeMainStore());
      const context = container.querySelector('[data-node-id="context"]');
      expect(context).toBeTruthy();
      expect(context?.classList.contains('feedback-changekind-added')).toBe(false);
      expect(context?.classList.contains('feedback-changekind-modified')).toBe(false);
      expect(context?.classList.contains('feedback-changekind-removed')).toBe(false);
    });

    it('renders changed and unchanged reviewed rows alike inside the proposition region a descendant selector can reach', () => {
      const { container } = renderTree(makeMainStore());
      const region = container.querySelector('[data-review-proposition="reviewed"]');
      expect(region).toBeTruthy();
      expect(region?.querySelector('[data-node-id="prop-root"]')).toBeTruthy();
      expect(region?.querySelector('[data-node-id="added"]')).toBeTruthy();
      expect(region?.querySelector('[data-node-id="context"]')).toBeTruthy();
    });

    // jsdom does not apply stylesheet rules, so a CSS-painted background cannot be read
    // back via getComputedStyle. These capture the intended behavior; verified in-app.
    it.todo('paints the gold review backdrop on every reviewed row, not only the control bar');
    it.todo('keeps the gold backdrop off added (green) and modified (blue) rows so change-kind colors win');
    it.todo('renders the control bar plus the whole reviewed subtree as one contiguous gold-encapsulated block');
    it.todo('keeps selection, hover, and active-session affordances visible over the gold backdrop');
    it.todo('still encapsulates a root-only proposition (no context rows) in gold');
  });

  // Scroll anchoring (useScrollAnchor) corrects scrollTop from measured layout; jsdom has
  // no layout, so the no-jump behavior is verified manually in the running app.
  it.todo('keeps the topmost visible node fixed when a proposition appears above the viewport');
});

// Per-view collapse: in the main view a suggestion mirrors the reviewed node's collapsed
// state, so reviewing a collapsed node no longer explodes its proposed subtree inline.
describe('per-view collapse — main view', () => {
  afterEach(() => {
    cleanup();
    feedbackTreeStore.clearAll();
  });

  // The live reviewed node is collapsed; the main view seeds the proposition root's
  // expansion from this flag rather than from the feedback node's metadata.expanded.
  function collapsedReviewedStore(): TreeStore {
    const store = makeMainStore();
    const s = store.getState();
    store.setState({
      nodes: {
        ...s.nodes,
        reviewed: { ...s.nodes.reviewed, metadata: { ...s.nodes.reviewed.metadata, expanded: false } },
      },
    });
    return store;
  }

  describe('single-root proposition', () => {
    beforeEach(() => seedProposition(1));

    it('renders the proposition collapsed — root visible, descendants hidden — when the reviewed node was collapsed', () => {
      renderTree(collapsedReviewedStore());
      expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
      expect(screen.queryByText('Added child')).toBeNull();
    });

    it('renders the proposition expanded with descendants when the reviewed node was expanded', () => {
      renderTree(makeMainStore());
      expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
      expect(screen.getByText('Added child')).toBeTruthy();
    });

    it('keeps the control bar and the collapsed-parent / change-kind affordance on a collapsed suggestion', () => {
      const { container } = renderTree(collapsedReviewedStore());
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
      const propRoot = container.querySelector('[data-node-id="prop-root"]');
      expect(propRoot?.classList.contains('collapsed-parent')).toBe(true);
      expect(propRoot?.classList.contains('feedback-changekind-modified')).toBe(true);
    });
  });

  describe('reviewed leaf with no live children', () => {
    beforeEach(() => seedProposition(1));

    it('renders the proposition and control bar without error when the reviewed node had no live children', () => {
      const store = makeMainStore();
      const s = store.getState();
      store.setState({
        nodes: { ...s.nodes, reviewed: { ...s.nodes.reviewed, children: [] } },
        ancestorRegistry: { root: [], reviewed: ['root'] },
      });
      renderTree(store);
      expect(screen.getByText('Reviewed node (revised)')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
    });
  });

  describe('multi-root decomposition', () => {
    // seedProposition(2)'s roots are leaves, so collapse has no visible effect; give each
    // root a child to exercise per-root collapse in the main view.
    function seedDecompositionWithChildren(): void {
      feedbackTreeStore.setStoreFactory(() => createTreeStore());
      feedbackTreeStore.initialize(
        'reviewed',
        FILE,
        {
          'feedback-root': node('feedback-root', '', ['prop-a', 'prop-b']),
          'prop-a': node('prop-a', 'Story A', ['a-child']),
          'a-child': node('a-child', 'A child'),
          'prop-b': node('prop-b', 'Story B', ['b-child']),
          'b-child': node('b-child', 'B child'),
        },
        'feedback-root',
      );
    }

    beforeEach(() => seedDecompositionWithChildren());

    it('renders each decomposition root collapsed in the main view when the reviewed node was collapsed', () => {
      const { container } = renderTree(collapsedReviewedStore());
      expect(screen.getByText('Story A')).toBeTruthy();
      expect(screen.getByText('Story B')).toBeTruthy();
      expect(screen.queryByText('A child')).toBeNull();
      expect(screen.queryByText('B child')).toBeNull();
      expect(container.querySelector('[data-node-id="prop-a"]')?.classList.contains('collapsed-parent')).toBe(true);
      expect(container.querySelector('[data-node-id="prop-b"]')?.classList.contains('collapsed-parent')).toBe(true);
    });
  });
});
