import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// An in-review node renders its proposition inline from a separate feedback store, under a
// [data-review-proposition="<reviewedNodeId>"] wrapper. The keyboard layer resolves the edit
// target from focus, so tree edit hotkeys act on the proposition row the user is focused on
// (in that proposition's own store) rather than falling through to the main store's
// previously focused node. These tests drive the REAL editingService + REAL shared.ts; only
// the lower deps are mocked, the same way shared.test.ts does.

const { mockActiveFilePath } = vi.hoisted(() => ({
  mockActiveFilePath: { value: '/test/file.arbo' as string | null },
}));
const { mockGetStoreForFile } = vi.hoisted(() => ({ mockGetStoreForFile: vi.fn() }));
const { mockGetStoreForNode } = vi.hoisted(() => ({ mockGetStoreForNode: vi.fn() }));
const { mockMatchesHotkey } = vi.hoisted(() => ({ mockMatchesHotkey: vi.fn() }));
const { mockHotkeyContext } = vi.hoisted(() => ({
  mockHotkeyContext: { value: { isInitialized: true as boolean, isHotkeyActiveInContext: () => true } },
}));

vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: { getState: () => ({ activeFilePath: mockActiveFilePath.value }) },
}));
vi.mock('../../../store/storeManager', () => ({
  storeManager: { getStoreForFile: mockGetStoreForFile },
}));
vi.mock('../../../store/feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: { getStoreForNode: mockGetStoreForNode },
}));
vi.mock('../../../store/hotkey/hotkeyContextStore', () => ({
  useHotkeyContextStore: { getState: () => mockHotkeyContext.value },
}));
// Mock at the module level (matchesHotkey is the imported util) so a keydown maps to a single
// chosen action without standing up the hotkey config store.
vi.mock('../../../utils/hotkeyConfig', () => ({
  matchesHotkey: (_event: KeyboardEvent, category: string, action: string) =>
    mockMatchesHotkey(category, action),
}));
vi.mock('../../cursorService', () => ({ getCursorPosition: () => 0 }));

import { initializeEditingService } from '../editingService';
import { getKeyboardEditTarget, getFocusedStore, getFocusedNodeElement, scrollToActiveNode } from '../shared';

type Baseline = 'added' | 'modified' | 'removed';

function makeStore(activeNodeId: string | null, nodeMetadata: Record<string, unknown> = {}) {
  const actions = {
    toggleStatus: vi.fn(),
    deleteNode: vi.fn(() => true),
    deleteSelectedNodes: vi.fn(),
    setCursorPosition: vi.fn(),
    scrollToNode: vi.fn(),
  };
  const nodes =
    activeNodeId === null
      ? {}
      : { [activeNodeId]: { id: activeNodeId, content: 'Node ' + activeNodeId, children: [], metadata: nodeMetadata } };
  return {
    actions,
    getState: () => ({ activeNodeId, nodes, multiSelectedNodeIds: undefined, actions }),
  };
}

// Mounts a `[data-node-id] > [contenteditable]` row. When `reviewedNodeId` is given the row
// is nested in the [data-review-proposition] wrapper TreeNode renders around an in-review
// node's inline proposition. Returns the contenteditable.
function mountNodeRow(
  nodeId: string,
  { reviewedNodeId }: { reviewedNodeId?: string } = {},
): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute('data-node-id', nodeId);
  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  row.appendChild(editable);

  if (reviewedNodeId) {
    const region = document.createElement('div');
    region.setAttribute('data-review-proposition', reviewedNodeId);
    region.appendChild(row);
    document.body.appendChild(region);
  } else {
    document.body.appendChild(row);
  }
  return editable;
}

function armHotkey(category: string, action: string): void {
  mockMatchesHotkey.mockImplementation((c: string, a: string) => c === category && a === action);
}

function pressHotkey(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  mockActiveFilePath.value = '/test/file.arbo';
  mockHotkeyContext.value = { isInitialized: true, isHotkeyActiveInContext: () => true };
  mockMatchesHotkey.mockImplementation(() => false);
  mockGetStoreForNode.mockReturnValue(null);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getKeyboardEditTarget', () => {
  it('resolves the focused proposition row to its own feedback store', () => {
    const feedback = makeStore('prop-root');
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    const editable = mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' });
    editable.focus();

    const target = getKeyboardEditTarget();
    expect(target?.store).toBe(feedback);
    expect(target?.nodeId).toBe('prop-root');
    expect(target?.element).toBe(editable);
  });

  it('resolves the main store + active node when focus is in the main tree', () => {
    const main = makeStore('A');
    mockGetStoreForFile.mockReturnValue(main);
    mountNodeRow('A');

    const target = getKeyboardEditTarget();
    expect(target?.store).toBe(main);
    expect(target?.nodeId).toBe('A');
  });

  it('returns null for a removed placeholder row (pending deletion is not editable)', () => {
    const feedback = makeStore('removed-1', { feedbackBaselineKind: 'removed' as Baseline });
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    mountNodeRow('removed-1', { reviewedNodeId: 'reviewed' }).focus();

    expect(getKeyboardEditTarget()).toBeNull();
  });

  it('returns null when focus is in a proposition with no backing store', () => {
    mockGetStoreForNode.mockReturnValue(null);
    mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' }).focus();

    expect(getKeyboardEditTarget()).toBeNull();
  });
});

// getFocusedStore / getFocusedNodeElement back navigation (arrow keys), so navigation also
// follows focus into a proposition instead of moving selection in the main tree underneath.
describe('getFocusedStore (navigation resolution)', () => {
  it('returns the proposition feedback store when focus is inside a proposition', () => {
    const main = makeStore('A');
    const feedback = makeStore('prop-root');
    mockGetStoreForFile.mockReturnValue(main);
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' }).focus();

    expect(getFocusedStore()).toBe(feedback);
  });

  it('returns the main store when focus is in the main tree', () => {
    const main = makeStore('A');
    mockGetStoreForFile.mockReturnValue(main);
    mountNodeRow('A').focus();

    expect(getFocusedStore()).toBe(main);
  });

  it('resolves the focused store\'s active node element', () => {
    const main = makeStore('A');
    const feedback = makeStore('prop-root');
    mockGetStoreForFile.mockReturnValue(main);
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    const editable = mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' });
    editable.focus();

    expect(getFocusedNodeElement()).toBe(editable);
  });

  it('scrollToActiveNode scrolls the focused proposition store, not the file store', () => {
    const main = makeStore('A');
    const feedback = makeStore('prop-root');
    mockGetStoreForFile.mockReturnValue(main);
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' }).focus();

    scrollToActiveNode();

    expect(feedback.actions.scrollToNode).toHaveBeenCalledWith('prop-root');
    expect(main.actions.scrollToNode).not.toHaveBeenCalled();
  });
});

describe('editingService — tree edit hotkeys follow focus into a review proposition', () => {
  let dispose: (() => void) | null = null;

  beforeEach(() => {
    dispose = initializeEditingService(window);
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it('toggles the focused proposition node in the review store, leaving the main node untouched', () => {
    const main = makeStore('A');
    const feedback = makeStore('prop-root');
    mockGetStoreForFile.mockReturnValue(main);
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    mountNodeRow('A');
    mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' }).focus();

    armHotkey('actions', 'toggleTaskStatus');
    pressHotkey();

    expect(feedback.actions.toggleStatus).toHaveBeenCalledWith('prop-root');
    expect(main.actions.toggleStatus).not.toHaveBeenCalled();
  });

  it('still toggles the focused main node when no review proposition is involved', () => {
    const main = makeStore('A');
    mockGetStoreForFile.mockReturnValue(main);

    mountNodeRow('A').focus();

    armHotkey('actions', 'toggleTaskStatus');
    pressHotkey();

    expect(main.actions.toggleStatus).toHaveBeenCalledWith('A');
  });

  it('routes the other tree edit hotkeys (e.g. delete) to the proposition row too', () => {
    const main = makeStore('A');
    const feedback = makeStore('prop-root');
    mockGetStoreForFile.mockReturnValue(main);
    mockGetStoreForNode.mockImplementation((id: string) => (id === 'reviewed' ? feedback : null));

    mountNodeRow('A');
    mountNodeRow('prop-root', { reviewedNodeId: 'reviewed' }).focus();

    armHotkey('actions', 'deleteNode');
    pressHotkey();

    expect(feedback.actions.deleteNode).toHaveBeenCalledWith('prop-root');
    expect(main.actions.deleteNode).not.toHaveBeenCalled();
  });

  it('is a no-op and does not throw when there is no editable target', () => {
    const main = makeStore(null);
    mockGetStoreForFile.mockReturnValue(main);

    armHotkey('actions', 'toggleTaskStatus');
    expect(() => pressHotkey()).not.toThrow();
    expect(main.actions.toggleStatus).not.toHaveBeenCalled();
  });

  // Accessibility / UX — visual focus retention is verified in the running app, not jsdom.
  it.todo('keyboard focus visibly stays on the proposition node after a status toggle');
});
