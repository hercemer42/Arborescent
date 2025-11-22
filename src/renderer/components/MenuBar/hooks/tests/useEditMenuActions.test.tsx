import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditMenuActions } from '../useEditMenuActions';
import * as useActiveTreeStoreModule from '../useActiveTreeStore';
import { logger } from '../../../../services/logger';

// Mock dependencies
vi.mock('../useActiveTreeStore', () => ({
  useActiveTreeStore: vi.fn(),
  useActiveTreeActions: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/markdown', () => ({
  exportNodeAsMarkdown: vi.fn(() => '- Test node\n'),
  parseMarkdown: vi.fn(() => ({ rootNodes: [], allNodes: {} })),
}));

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: vi.fn(() => ({ activeFilePath: null })),
  },
}));

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(),
  },
}));

describe('useEditMenuActions', () => {
  const mockUseActiveTreeStore = vi.mocked(useActiveTreeStoreModule.useActiveTreeStore);
  const mockUseActiveTreeActions = vi.mocked(useActiveTreeStoreModule.useActiveTreeActions);

  let mockClipboardWriteText: ReturnType<typeof vi.fn>;
  let mockClipboardReadText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard API
    mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    mockClipboardReadText = vi.fn().mockResolvedValue('');
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockClipboardWriteText,
        readText: mockClipboardReadText,
      },
      writable: true,
      configurable: true,
    });

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
      mockUseActiveTreeStore.mockReturnValue(null);
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
      mockUseActiveTreeStore.mockReturnValue(null);
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
      mockUseActiveTreeStore.mockReturnValue(null);
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
  });

  describe('handleCut', () => {
    it('should do nothing when treeState not available', async () => {
      mockUseActiveTreeStore.mockReturnValue(null);
      mockUseActiveTreeActions.mockReturnValue({ deleteNode: vi.fn() } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });

    it('should do nothing when no activeNodeId', async () => {
      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: null,
        nodes: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: vi.fn(),
        startDeleteAnimation: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });

    it('should copy node to clipboard and start delete animation', async () => {
      const mockStartDeleteAnimation = vi.fn();
      const mockDeleteNode = vi.fn();

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: mockDeleteNode,
        startDeleteAnimation: mockStartDeleteAnimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(mockClipboardWriteText).toHaveBeenCalledWith('- Test node\n');
      expect(mockStartDeleteAnimation).toHaveBeenCalledWith('node-1', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Cut node to clipboard: node-1', 'EditMenu');
    });

    it('should call deleteNode when animation callback is executed', async () => {
      const mockDeleteNode = vi.fn();
      let animationCallback: (() => void) | undefined;
      const mockStartDeleteAnimation = vi.fn((nodeId, callback) => {
        animationCallback = callback;
      });

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: mockDeleteNode,
        startDeleteAnimation: mockStartDeleteAnimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      // Simulate animation completing
      act(() => {
        animationCallback?.();
      });

      expect(mockDeleteNode).toHaveBeenCalledWith('node-1', true);
    });

    it('should log error when clipboard write fails', async () => {
      const error = new Error('Clipboard error');
      mockClipboardWriteText.mockRejectedValue(error);

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: vi.fn(),
        startDeleteAnimation: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCut();
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to cut node', error, 'EditMenu');
    });
  });

  describe('handleCopy', () => {
    it('should copy node to clipboard and flash node', async () => {
      const mockFlashNode = vi.fn();

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        flashNode: mockFlashNode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(mockClipboardWriteText).toHaveBeenCalledWith('- Test node\n');
      expect(mockFlashNode).toHaveBeenCalledWith('node-1', 'light');
      expect(logger.info).toHaveBeenCalledWith('Copied node to clipboard: node-1', 'EditMenu');
    });

    it('should do nothing when no activeNodeId', async () => {
      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: null,
        nodes: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        flashNode: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });
  });

  describe('handleDelete', () => {
    it('should start delete animation', () => {
      const mockStartDeleteAnimation = vi.fn();

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: vi.fn(),
        startDeleteAnimation: mockStartDeleteAnimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleDelete();
      });

      expect(mockStartDeleteAnimation).toHaveBeenCalledWith('node-1', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Deleted node: node-1', 'EditMenu');
    });

    it('should call deleteNode when animation callback is executed', () => {
      const mockDeleteNode = vi.fn();
      let animationCallback: (() => void) | undefined;
      const mockStartDeleteAnimation = vi.fn((nodeId, callback) => {
        animationCallback = callback;
      });

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {
          'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: mockDeleteNode,
        startDeleteAnimation: mockStartDeleteAnimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleDelete();
      });

      // Simulate animation completing
      act(() => {
        animationCallback?.();
      });

      expect(mockDeleteNode).toHaveBeenCalledWith('node-1', true);
    });

    it('should do nothing when no activeNodeId', () => {
      const mockStartDeleteAnimation = vi.fn();

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: null,
        nodes: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: vi.fn(),
        startDeleteAnimation: mockStartDeleteAnimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleDelete();
      });

      expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
    });

    it('should do nothing when node does not exist', () => {
      const mockStartDeleteAnimation = vi.fn();

      mockUseActiveTreeStore.mockReturnValue({
        activeNodeId: 'node-1',
        nodes: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockUseActiveTreeActions.mockReturnValue({
        deleteNode: vi.fn(),
        startDeleteAnimation: mockStartDeleteAnimation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { result } = renderHook(() => useEditMenuActions());

      act(() => {
        result.current.handleDelete();
      });

      expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
    });
  });
});
