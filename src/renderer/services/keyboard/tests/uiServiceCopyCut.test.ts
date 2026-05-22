import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetHotkeyConfig } from '../../../utils/hotkeyConfig';
import { initializeUIService } from '../uiService';
import { useHotkeyContextStore } from '../../../store/hotkey/hotkeyContextStore';

// Toggleable mocks for selection state
const selectionState = {
  hasTextSelection: false,
  isFocusInTerminalOrBrowser: false,
  isContentEditableFocused: false,
  isInputOrTextareaFocused: false,
  isFocusInPanel: false,
  isSelectionInContentEditable: false,
  isSelectionInRichContent: false,
  selectionNodeId: null as string | null,
  selectionSpansSingleNode: true,
};

vi.mock('../../../utils/selectionUtils', () => ({
  hasTextSelection: () => selectionState.hasTextSelection,
  isContentEditableFocused: () => selectionState.isContentEditableFocused,
  isFocusInPanel: () => selectionState.isFocusInPanel,
  isFocusInTerminalOrBrowser: () => selectionState.isFocusInTerminalOrBrowser,
  isInputOrTextareaFocused: () => selectionState.isInputOrTextareaFocused,
  isSelectionInContentEditable: () => selectionState.isSelectionInContentEditable,
  isSelectionInRichContent: () => selectionState.isSelectionInRichContent,
  getSelectionNodeId: () => selectionState.selectionNodeId,
  selectionSpansSingleNode: () => selectionState.selectionSpansSingleNode,
}));

const mockCutNodes = vi.fn();
const mockCopyNodes = vi.fn();
const mockUpdateContent = vi.fn();
const mockCopySelectionText = vi.fn();
const mockCutSelectionFromNodeContent = vi.fn();

vi.mock('../../partialTextClipboard', () => ({
  copySelectionText: (text: string) => mockCopySelectionText(text),
  cutSelectionFromNodeContent: (
    selectionText: string,
    nodeContent: string,
    applyContent: (newContent: string) => void
  ) => mockCutSelectionFromNodeContent(selectionText, nodeContent, applyContent),
}));

vi.mock('../shared', () => ({
  getActiveStore: () => ({
    getState: () => ({
      activeNodeId: 'node-1',
      nodes: { 'node-1': { id: 'node-1', content: 'hello world', children: [], metadata: {} } },
      ancestorRegistry: {},
      contextDeclarations: [],
      actions: {
        cutNodes: mockCutNodes,
        copyNodes: mockCopyNodes,
        updateContent: mockUpdateContent,
      },
    }),
  }),
}));

vi.mock('../../../utils/nodeHelpers', () => ({
  getAppliedContextIdWithInheritance: () => null,
  resolveContextFlags: () => ({ collaborate: true, execute: false }),
}));

vi.mock('../../../store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: { getState: () => ({ actions: {} }) },
}));

vi.mock('../../../store/search/searchStore', () => ({
  useSearchStore: { getState: () => ({ openSearch: vi.fn() }) },
}));

function resetSelectionState(): void {
  selectionState.hasTextSelection = false;
  selectionState.isFocusInTerminalOrBrowser = false;
  selectionState.isContentEditableFocused = false;
  selectionState.isInputOrTextareaFocused = false;
  selectionState.isFocusInPanel = false;
  selectionState.isSelectionInContentEditable = false;
  selectionState.isSelectionInRichContent = false;
  selectionState.selectionNodeId = null;
  selectionState.selectionSpansSingleNode = true;
}

function mockWindowSelection(text: string): void {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    toString: () => text,
    anchorNode: null,
  } as unknown as Selection);
}

describe('uiService copy/cut hotkeys with partial text selection', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    const hotkeyStore = useHotkeyContextStore.getState();
    hotkeyStore.setInitialized(true);
    hotkeyStore.setContext('global');
    resetHotkeyConfig();
    resetSelectionState();
    mockCutNodes.mockReset();
    mockCopyNodes.mockReset();
    mockUpdateContent.mockReset();
    mockCopySelectionText.mockReset();
    mockCutSelectionFromNodeContent.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe('copy hotkey (Ctrl+C)', () => {
    it('calls copyNodes and preventDefaults when no text is selected', () => {
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCopyNodes).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('does NOT call copyNodes when partial text is highlighted (lets browser handle native copy)', () => {
      selectionState.hasTextSelection = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCopyNodes).not.toHaveBeenCalled();
    });

    it('does NOT preventDefault when partial text is highlighted (browser-native copy must fire)', () => {
      selectionState.hasTextSelection = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it('does not call copyNodes when focus is in terminal or browser panel', () => {
      selectionState.isFocusInTerminalOrBrowser = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCopyNodes).not.toHaveBeenCalled();
    });

    it('does not call copyNodes and does not preventDefault when focus is in input/textarea (lets native input copy fire)', () => {
      selectionState.isInputOrTextareaFocused = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCopyNodes).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('falls back to whole-node copyNodes when the text selection spans multiple nodes', () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = false;
      selectionState.selectionSpansSingleNode = false;
      mockWindowSelection('cross-node text');

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCopyNodes).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('cut hotkey (Ctrl+X)', () => {
    it('calls cutNodes and preventDefaults when no text is selected', () => {
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCutNodes).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('does NOT call cutNodes when partial text is highlighted', () => {
      selectionState.hasTextSelection = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCutNodes).not.toHaveBeenCalled();
    });

    it('does not call cutNodes when focus is in terminal or browser panel', () => {
      selectionState.isFocusInTerminalOrBrowser = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCutNodes).not.toHaveBeenCalled();
    });

    it('does not call cutNodes and does not preventDefault when focus is in input/textarea (lets native input cut fire)', () => {
      selectionState.isInputOrTextareaFocused = true;
      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(mockCutNodes).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('routes through cutSelectionFromNodeContent (clipboard + undo-aware content update) when partial text is cut from a non-contenteditable single node', async () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = false;
      selectionState.selectionNodeId = 'node-1';
      selectionState.selectionSpansSingleNode = true;
      mockWindowSelection('world');

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      await Promise.resolve();
      await Promise.resolve();

      expect(mockCutSelectionFromNodeContent).toHaveBeenCalledTimes(1);
      expect(mockCutSelectionFromNodeContent.mock.calls[0][0]).toBe('world');
      expect(mockCutSelectionFromNodeContent.mock.calls[0][1]).toBe('hello world');
      expect(mockCutNodes).not.toHaveBeenCalled();
    });

    it('routes the content-update callback through actions.updateContent (undo-aware) for partial cut', async () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = false;
      selectionState.selectionNodeId = 'node-1';
      selectionState.selectionSpansSingleNode = true;
      mockWindowSelection('world');

      mockCutSelectionFromNodeContent.mockImplementation(
        async (_text: string, _content: string, apply: (next: string) => void) => {
          apply('hello ');
        }
      );

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      await Promise.resolve();
      await Promise.resolve();

      expect(mockUpdateContent).toHaveBeenCalledWith('node-1', 'hello ');
    });

    it('falls back to whole-node cutNodes when the selection spans multiple nodes', async () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = false;
      selectionState.selectionNodeId = 'node-1';
      selectionState.selectionSpansSingleNode = false;
      mockWindowSelection('spans multiple');

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      await Promise.resolve();

      expect(mockCutNodes).toHaveBeenCalledTimes(1);
      expect(mockCutSelectionFromNodeContent).not.toHaveBeenCalled();
    });

    it('copies the substring (no content mutation) when the selection has no associated node id', async () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = false;
      selectionState.selectionNodeId = null;
      selectionState.selectionSpansSingleNode = true;
      mockWindowSelection('orphan');

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      await Promise.resolve();

      expect(mockCopySelectionText).toHaveBeenCalledWith('orphan');
      expect(mockCutNodes).not.toHaveBeenCalled();
      expect(mockCutSelectionFromNodeContent).not.toHaveBeenCalled();
      expect(mockUpdateContent).not.toHaveBeenCalled();
    });

    it('lets the browser handle cut natively when the selection is inside a contenteditable', () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = true;
      mockWindowSelection('inside editor');

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(mockCutNodes).not.toHaveBeenCalled();
      expect(mockCutSelectionFromNodeContent).not.toHaveBeenCalled();
    });

    it('degrades to copy-only (no content mutation) when the selection is inside rich-rendered content', async () => {
      selectionState.hasTextSelection = true;
      selectionState.isSelectionInContentEditable = false;
      selectionState.isSelectionInRichContent = true;
      selectionState.selectionNodeId = 'node-1';
      selectionState.selectionSpansSingleNode = true;
      mockWindowSelection('foo');

      cleanup = initializeUIService(window);

      const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, cancelable: true });
      window.dispatchEvent(event);

      await Promise.resolve();

      expect(mockCopySelectionText).toHaveBeenCalledWith('foo');
      expect(mockCutSelectionFromNodeContent).not.toHaveBeenCalled();
      expect(mockUpdateContent).not.toHaveBeenCalled();
      expect(mockCutNodes).not.toHaveBeenCalled();
    });
  });
});
