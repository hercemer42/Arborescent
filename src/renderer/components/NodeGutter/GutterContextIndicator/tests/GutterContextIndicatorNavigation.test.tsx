import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import { GutterContextIndicator } from '../GutterContextIndicator';
import { AppliedContext } from '../../../TreeNode/hooks/useAppliedContexts';
import type { TreeNode } from '@shared/types';

// The shared jump touches the files store (zoom / active file). Expose stable
// spies so the zoom-exit edge case can be asserted.
const mockSetActiveFile = vi.fn();
let mockActiveFile: unknown = null;

vi.mock('../../../../store/files/filesStore', () => ({
  // treeStore wires file-action access at load time via this export.
  setFileActionsStoreAccess: vi.fn(),
  useFilesStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({
        getActiveFile: () => mockActiveFile,
        setActiveFile: mockSetActiveFile,
      }),
    {
      getState: vi.fn(() => ({
        getActiveFile: () => mockActiveFile,
        setActiveFile: mockSetActiveFile,
      })),
    }
  ),
}));

vi.mock('../../../../store/browser/browserStore', () => ({
  useBrowserStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({ actions: { addTab: vi.fn() } }),
    { getState: vi.fn(() => ({ actions: { addTab: vi.fn() } })) }
  ),
}));

vi.mock('../../../../store/panel/panelStore', () => ({
  usePanelStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({ showBrowser: vi.fn() }),
    { getState: vi.fn(() => ({ showBrowser: vi.fn() })) }
  ),
}));

vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: vi.fn(() => ({ addToast: vi.fn() })) },
}));

describe('GutterContextIndicator — navigation & clickability', () => {
  let store: TreeStore;
  const mockSelectNode = vi.fn();
  const mockToggleNode = vi.fn();
  const mockFlashNode = vi.fn();

  // A real applied context carries the declaration node id → navigable.
  const navigableContext: AppliedContext = {
    icon: 'star',
    color: undefined,
    name: 'Design Guidelines',
    collaborate: true,
    execute: false,
    id: 'ctx-1',
  };

  // A synthetic built-in context has no declaration node → inert.
  const syntheticContext: AppliedContext = {
    icon: 'Zap',
    color: undefined,
    name: 'Basic execution',
    collaborate: true,
    execute: true,
  };

  const declarationNode: TreeNode = {
    id: 'ctx-1',
    content: 'Design Guidelines',
    children: [],
    metadata: { isContextDeclaration: true, isBlueprint: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveFile = null;
    store = createTreeStore();
    store.setState({
      nodes: { 'ctx-1': declarationNode },
      ancestorRegistry: { 'ctx-1': [] },
      blueprintModeEnabled: false,
      scrollToNodeId: null,
      actions: {
        selectNode: mockSelectNode,
        toggleNode: mockToggleNode,
        flashNode: mockFlashNode,
        toggleBlueprintMode: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const renderWithStore = (ui: React.ReactNode) =>
    render(<TreeStoreContext.Provider value={store}>{ui}</TreeStoreContext.Provider>);

  const navButton = (container: HTMLElement) =>
    container.querySelector('button.gutter-context-indicator') as HTMLButtonElement | null;

  describe('affordance', () => {
    it('renders a navigable context icon as a button', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      expect(navButton(container)).toBeInTheDocument();
    });

    it('marks the navigable icon with a class for the pointer-cursor affordance', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      expect(container.querySelector('.context-navigable')).toBeInTheDocument();
    });

    it('renders the navigable icon as a focusable, non-disabled button (keyboard reachable)', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      const btn = navButton(container);
      expect(btn).toBeInTheDocument();
      expect(btn?.disabled).toBe(false);
    });

    it('renders a synthetic (no-id) context icon as an inert span, not a button', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={syntheticContext} />);
      expect(container.querySelector('button')).not.toBeInTheDocument();
      expect(container.querySelector('span.gutter-context-indicator')).toBeInTheDocument();
      expect(container.querySelector('.context-navigable')).not.toBeInTheDocument();
    });
  });

  describe('happy path', () => {
    it('navigates to the declaration node on click (select + scroll + flash)', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      fireEvent.click(navButton(container)!);

      expect(mockSelectNode).toHaveBeenCalledWith('ctx-1', 0);
      expect(mockFlashNode).toHaveBeenCalledWith('ctx-1', 'light');
      expect(store.getState().scrollToNodeId).toBe('ctx-1');
    });

    it('expands collapsed ancestors of the declaration before navigating', () => {
      store.setState({
        nodes: {
          ...store.getState().nodes,
          ancestor: { id: 'ancestor', content: 'Ancestor', children: ['ctx-1'], metadata: { expanded: false } },
        },
        ancestorRegistry: { 'ctx-1': ['ancestor'], ancestor: [] },
      });
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      fireEvent.click(navButton(container)!);

      expect(mockToggleNode).toHaveBeenCalledWith('ancestor');
    });
  });

  describe('edge cases', () => {
    it("does not expand the declaration node's own subtree", () => {
      store.setState({
        nodes: {
          'ctx-1': { ...declarationNode, children: ['ctx-child'], metadata: { ...declarationNode.metadata, expanded: false } },
          'ctx-child': { id: 'ctx-child', content: 'child', children: [], metadata: {} },
        },
        ancestorRegistry: { 'ctx-1': [], 'ctx-child': ['ctx-1'] },
      });
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      fireEvent.click(navButton(container)!);

      expect(mockToggleNode).not.toHaveBeenCalledWith('ctx-1');
    });

    it('switches out of a zoom tab to the main view before navigating', () => {
      mockActiveFile = { zoomSource: { sourceFilePath: '/main.arbo' } };
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      fireEvent.click(navButton(container)!);

      expect(mockSetActiveFile).toHaveBeenCalledWith('/main.arbo');
    });

    it('does not bubble the click to the surrounding row/gutter', () => {
      const parentClick = vi.fn();
      const { container } = renderWithStore(
        <div onClick={parentClick}>
          <GutterContextIndicator appliedContext={navigableContext} />
        </div>
      );
      fireEvent.click(navButton(container)!);

      expect(parentClick).not.toHaveBeenCalled();
    });

    it('navigates again on a repeated click', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      const btn = navButton(container)!;
      fireEvent.click(btn);
      fireEvent.click(btn);

      expect(mockSelectNode).toHaveBeenCalledTimes(2);
    });
  });

  describe('inert synthetic icon', () => {
    it('does nothing when a synthetic (no-id) icon is clicked', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={syntheticContext} />);
      const span = container.querySelector('span.gutter-context-indicator') as HTMLElement;
      fireEvent.click(span);

      expect(mockSelectNode).not.toHaveBeenCalled();
      expect(mockFlashNode).not.toHaveBeenCalled();
    });
  });

  describe('tooltip preserved', () => {
    it('still shows the hover tooltip on the navigable icon', () => {
      const { container } = renderWithStore(<GutterContextIndicator appliedContext={navigableContext} />);
      const indicator = container.querySelector('.gutter-context-indicator') as HTMLElement;
      fireEvent.mouseEnter(indicator);

      expect(screen.getByText('Applied context:')).toBeInTheDocument();
      expect(screen.getByText('Design Guidelines')).toBeInTheDocument();
    });
  });

  // jsdom does not synthesize a click from Enter/Space on native buttons; the
  // semantic <button> guarantees this in-browser. Behavior verified manually.
  it.todo('activates navigation via the Enter and Space keys');
});
