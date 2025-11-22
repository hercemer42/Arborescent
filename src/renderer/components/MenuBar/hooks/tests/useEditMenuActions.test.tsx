import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditMenuActions } from '../useEditMenuActions';
import * as useActiveTreeStoreModule from '../useActiveTreeStore';
import { logger } from '../../../../services/logger';

// Mock dependencies
vi.mock('../useActiveTreeStore', () => ({
  useActiveTreeActions: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useEditMenuActions', () => {
  const mockUseActiveTreeActions = vi.mocked(useActiveTreeStoreModule.useActiveTreeActions);

  beforeEach(() => {
    vi.clearAllMocks();

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
