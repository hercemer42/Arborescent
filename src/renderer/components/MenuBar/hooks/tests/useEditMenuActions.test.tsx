import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditMenuActions } from '../useEditMenuActions';
import * as useActiveTreeStoreModule from '../useActiveTreeStore';
import { logger } from '../../../../services/logger';

const mockCopySelectionText = vi.fn();
const mockCutSelectionFromNodeContent = vi.fn();

vi.mock('../../../../services/partialTextClipboard', () => ({
  copySelectionText: (text: string) => mockCopySelectionText(text),
  cutSelectionFromNodeContent: (
    selectionText: string,
    nodeContent: string,
    applyContent: (newContent: string) => void
  ) => mockCutSelectionFromNodeContent(selectionText, nodeContent, applyContent),
}));

// Mock dependencies
vi.mock('../useActiveTreeStore', () => ({
  useActiveTreeActions: vi.fn(),
  useActiveTreeStore: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useEditMenuActions', () => {
  const mockUseActiveTreeActions = vi.mocked(useActiveTreeStoreModule.useActiveTreeActions);
  const mockUseActiveTreeStore = vi.mocked(useActiveTreeStoreModule.useActiveTreeStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCopySelectionText.mockReset();
    mockCutSelectionFromNodeContent.mockReset();

    // Default mock for useActiveTreeStore
    mockUseActiveTreeStore.mockReturnValue({
      activeNodeId: null,
      nodes: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Define window.getSelection if it doesn't exist (jsdom may not have it)
    if (!window.getSelection) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).getSelection = vi.fn();
    }

    // Mock window.getSelection to return no selection by default
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: true,
      anchorNode: null,
    } as unknown as Selection);

    // Mock document.execCommand (deprecated but still used)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleUndo', () => {
    it('should call actions.undo when actions available', () => {
      const mockUndo = vi.fn();
      mockUseActiveTreeActions.mockReturnValue({
        undo: mockUndo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleUndo();
      });

      expect(mockUndo).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Undo executed from menu', 'EditMenu');
    });

    it('should do nothing when actions not available', () => {
      mockUseActiveTreeActions.mockReturnValue(null);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleUndo();
      });

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('handleRedo', () => {
    it('should call actions.redo when actions available', () => {
      const mockRedo = vi.fn();
      mockUseActiveTreeActions.mockReturnValue({
        redo: mockRedo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleRedo();
      });

      expect(mockRedo).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Redo executed from menu', 'EditMenu');
    });

    it('should do nothing when actions not available', () => {
      mockUseActiveTreeActions.mockReturnValue(null);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleRedo();
      });

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('handleCut', () => {
    it('should call actions.cutNodes when no text selection', async () => {
      const mockCutNodes = vi.fn().mockResolvedValue('cut');
      mockUseActiveTreeActions.mockReturnValue({
        cutNodes: mockCutNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockCutNodes).toHaveBeenCalled();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('should use browser cut when text is selected in contenteditable', async () => {
      const mockCutNodes = vi.fn().mockResolvedValue('cut');
      mockUseActiveTreeActions.mockReturnValue({
        cutNodes: mockCutNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Mock text selection in contenteditable
      const mockContentEditable = document.createElement('div');
      mockContentEditable.setAttribute('contenteditable', 'true');
      const textNode = document.createTextNode('test');
      mockContentEditable.appendChild(textNode);
      document.body.appendChild(mockContentEditable);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        anchorNode: textNode,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(document.execCommand).toHaveBeenCalledWith('cut');
      expect(mockCutNodes).not.toHaveBeenCalled();

      document.body.removeChild(mockContentEditable);
    });

    it('should do nothing when actions not available', async () => {
      mockUseActiveTreeActions.mockReturnValue(null);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('should NOT call cutNodes when text is selected inside a non-contenteditable .node-text', async () => {
      const mockCutNodes = vi.fn().mockResolvedValue('cut');
      mockUseActiveTreeActions.mockReturnValue({
        cutNodes: mockCutNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('partial select');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'partial',
        anchorNode: textNode,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockCutNodes).not.toHaveBeenCalled();

      document.body.removeChild(nodeText);
    });

    it('routes through cutSelectionFromNodeContent (clipboard + undo-aware updateContent) for partial cut on a non-contenteditable .node-text', async () => {
      const mockCutNodes = vi.fn().mockResolvedValue('cut');
      const mockUpdateContent = vi.fn();
      mockUseActiveTreeActions.mockReturnValue({
        cutNodes: mockCutNodes,
        updateContent: mockUpdateContent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: { 'node-1': { id: 'node-1', content: 'hello world', children: [], metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-node-id', 'node-1');
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('hello world');
      nodeText.appendChild(textNode);
      wrapper.appendChild(nodeText);
      document.body.appendChild(wrapper);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'world',
        anchorNode: textNode,
        focusNode: textNode,
      } as unknown as Selection);

      mockCutSelectionFromNodeContent.mockImplementation(
        async (_t: string, _c: string, apply: (next: string) => void) => apply('hello ')
      );

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockCutSelectionFromNodeContent).toHaveBeenCalledTimes(1);
      expect(mockCutSelectionFromNodeContent.mock.calls[0][0]).toBe('world');
      expect(mockCutSelectionFromNodeContent.mock.calls[0][1]).toBe('hello world');
      expect(mockUpdateContent).toHaveBeenCalledWith('node-1', 'hello ');
      expect(mockCutNodes).not.toHaveBeenCalled();

      document.body.removeChild(wrapper);
    });

    it('degrades to copy-only (no content mutation) when the selection is inside rich-rendered .node-text (data-rich="true")', async () => {
      const mockCutNodes = vi.fn().mockResolvedValue('cut');
      const mockUpdateContent = vi.fn();
      mockUseActiveTreeActions.mockReturnValue({
        cutNodes: mockCutNodes,
        updateContent: mockUpdateContent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: { 'node-1': { id: 'node-1', content: 'use `foo` for X', children: [], metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-node-id', 'node-1');
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      nodeText.setAttribute('data-rich', 'true');
      const textNode = document.createTextNode('use foo for X');
      nodeText.appendChild(textNode);
      wrapper.appendChild(nodeText);
      document.body.appendChild(wrapper);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'foo',
        anchorNode: textNode,
        focusNode: textNode,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockCopySelectionText).toHaveBeenCalledWith('foo');
      expect(mockCutSelectionFromNodeContent).not.toHaveBeenCalled();
      expect(mockUpdateContent).not.toHaveBeenCalled();
      expect(mockCutNodes).not.toHaveBeenCalled();

      document.body.removeChild(wrapper);
    });

    it('falls back to whole-node cutNodes when the selection spans multiple nodes', async () => {
      const mockCutNodes = vi.fn().mockResolvedValue('cut');
      const mockUpdateContent = vi.fn();
      mockUseActiveTreeActions.mockReturnValue({
        cutNodes: mockCutNodes,
        updateContent: mockUpdateContent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'first', children: [], metadata: {} },
          'node-2': { id: 'node-2', content: 'second', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const wrapper1 = document.createElement('div');
      wrapper1.setAttribute('data-node-id', 'node-1');
      const nodeText1 = document.createElement('div');
      nodeText1.className = 'node-text';
      const textNode1 = document.createTextNode('first');
      nodeText1.appendChild(textNode1);
      wrapper1.appendChild(nodeText1);
      document.body.appendChild(wrapper1);

      const wrapper2 = document.createElement('div');
      wrapper2.setAttribute('data-node-id', 'node-2');
      const nodeText2 = document.createElement('div');
      nodeText2.className = 'node-text';
      const textNode2 = document.createTextNode('second');
      nodeText2.appendChild(textNode2);
      wrapper2.appendChild(nodeText2);
      document.body.appendChild(wrapper2);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'first\nsecond',
        anchorNode: textNode1,
        focusNode: textNode2,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockCutNodes).toHaveBeenCalledTimes(1);
      expect(mockCutSelectionFromNodeContent).not.toHaveBeenCalled();
      expect(mockUpdateContent).not.toHaveBeenCalled();

      document.body.removeChild(wrapper1);
      document.body.removeChild(wrapper2);
    });
  });

  describe('handleCopy', () => {
    it('should call actions.copyNodes when no text selection', async () => {
      const mockCopyNodes = vi.fn().mockResolvedValue('copied');
      mockUseActiveTreeActions.mockReturnValue({
        copyNodes: mockCopyNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(mockCopyNodes).toHaveBeenCalled();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('should use browser copy when text is selected in contenteditable', async () => {
      const mockCopyNodes = vi.fn().mockResolvedValue('copied');
      mockUseActiveTreeActions.mockReturnValue({
        copyNodes: mockCopyNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Mock text selection in contenteditable
      const mockContentEditable = document.createElement('div');
      mockContentEditable.setAttribute('contenteditable', 'true');
      const textNode = document.createTextNode('test');
      mockContentEditable.appendChild(textNode);
      document.body.appendChild(mockContentEditable);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        anchorNode: textNode,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(mockCopyNodes).not.toHaveBeenCalled();

      document.body.removeChild(mockContentEditable);
    });

    it('should do nothing when actions not available', async () => {
      mockUseActiveTreeActions.mockReturnValue(null);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('should NOT call copyNodes when text is selected inside a non-contenteditable .node-text', async () => {
      const mockCopyNodes = vi.fn().mockResolvedValue('copied');
      mockUseActiveTreeActions.mockReturnValue({
        copyNodes: mockCopyNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('partial select');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'partial',
        anchorNode: textNode,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(mockCopyNodes).not.toHaveBeenCalled();

      document.body.removeChild(nodeText);
    });

    it('should fall back to whole-node copyNodes when the text selection spans multiple nodes', async () => {
      const mockCopyNodes = vi.fn().mockResolvedValue('copied');
      mockUseActiveTreeActions.mockReturnValue({
        copyNodes: mockCopyNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const wrapper1 = document.createElement('div');
      wrapper1.setAttribute('data-node-id', 'node-1');
      const nodeText1 = document.createElement('div');
      nodeText1.className = 'node-text';
      const textNode1 = document.createTextNode('first');
      nodeText1.appendChild(textNode1);
      wrapper1.appendChild(nodeText1);
      document.body.appendChild(wrapper1);

      const wrapper2 = document.createElement('div');
      wrapper2.setAttribute('data-node-id', 'node-2');
      const nodeText2 = document.createElement('div');
      nodeText2.className = 'node-text';
      const textNode2 = document.createTextNode('second');
      nodeText2.appendChild(textNode2);
      wrapper2.appendChild(nodeText2);
      document.body.appendChild(wrapper2);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'first\nsecond',
        anchorNode: textNode1,
        focusNode: textNode2,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(mockCopyNodes).toHaveBeenCalledTimes(1);
      expect(mockCopySelectionText).not.toHaveBeenCalled();

      document.body.removeChild(wrapper1);
      document.body.removeChild(wrapper2);
    });

    it('should leave the tree unchanged when copying highlighted text from a non-contenteditable .node-text', async () => {
      const mockCopyNodes = vi.fn().mockResolvedValue('copied');
      const mockUpdateContent = vi.fn();
      mockUseActiveTreeActions.mockReturnValue({
        copyNodes: mockCopyNodes,
        updateContent: mockUpdateContent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('hello world');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'hello',
        anchorNode: textNode,
      } as unknown as Selection);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(mockCopyNodes).not.toHaveBeenCalled();
      expect(mockUpdateContent).not.toHaveBeenCalled();

      document.body.removeChild(nodeText);
    });
  });

  describe('handlePaste', () => {
    it('should call actions.pasteNodes', async () => {
      const mockPasteNodes = vi.fn().mockResolvedValue('pasted');
      mockUseActiveTreeActions.mockReturnValue({
        pasteNodes: mockPasteNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(mockPasteNodes).toHaveBeenCalled();
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('should fall back to browser paste when no valid markdown and contenteditable focused', async () => {
      const mockPasteNodes = vi.fn().mockResolvedValue('no-content');
      mockUseActiveTreeActions.mockReturnValue({
        pasteNodes: mockPasteNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Mock contenteditable being focused
      const mockContentEditable = document.createElement('div');
      mockContentEditable.setAttribute('contenteditable', 'true');
      document.body.appendChild(mockContentEditable);
      mockContentEditable.focus();
      Object.defineProperty(document, 'activeElement', {
        value: mockContentEditable,
        configurable: true,
      });

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(mockPasteNodes).toHaveBeenCalled();
      expect(document.execCommand).toHaveBeenCalledWith('paste');

      document.body.removeChild(mockContentEditable);
    });

    it('should do nothing when actions not available', async () => {
      mockUseActiveTreeActions.mockReturnValue(null);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(document.execCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleDelete', () => {
    it('should call actions.deleteSelectedNodes', () => {
      const mockDeleteSelectedNodes = vi.fn().mockReturnValue('deleted');
      mockUseActiveTreeActions.mockReturnValue({
        deleteSelectedNodes: mockDeleteSelectedNodes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleDelete();
      });

      expect(mockDeleteSelectedNodes).toHaveBeenCalled();
    });

    it('should do nothing when actions not available', () => {
      mockUseActiveTreeActions.mockReturnValue(null);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleDelete();
      });

      // No error should be thrown
    });
  });
});
