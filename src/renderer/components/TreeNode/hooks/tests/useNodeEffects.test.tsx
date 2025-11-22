import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeEffects } from '../useNodeEffects';
import { useStore } from '../../../../store/tree/useStore';

// Mock the useStore hook
vi.mock('../../../../store/tree/useStore', () => ({
  useStore: vi.fn(),
}));

describe('useNodeEffects', () => {
  const mockUseStore = vi.mocked(useStore);
  let mockClearDeleteAnimation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClearDeleteAnimation = vi.fn();

    // Default mock implementation
    mockUseStore.mockImplementation((selector) => {
      const state = {
        flashingNode: null,
        deletingNodeId: null,
        scrollToNodeId: null,
        actions: {
          clearDeleteAnimation: mockClearDeleteAnimation,
        },
      };
      return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  });

  describe('flashIntensity', () => {
    it('should return null when no flashing node', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.flashIntensity).toBe(null);
    });

    it('should return light intensity when node is flashing with light', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: { nodeId: 'node-1', intensity: 'light' as const },
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.flashIntensity).toBe('light');
    });

    it('should return medium intensity when node is flashing with medium', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: { nodeId: 'node-1', intensity: 'medium' as const },
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.flashIntensity).toBe('medium');
    });

    it('should return null when different node is flashing', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: { nodeId: 'node-2', intensity: 'light' as const },
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.flashIntensity).toBe(null);
    });
  });

  describe('isDeleting', () => {
    it('should return false when no deleting node', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.isDeleting).toBe(false);
    });

    it('should return true when this node is deleting', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: 'node-1',
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.isDeleting).toBe(true);
    });

    it('should return false when different node is deleting', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: 'node-2',
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.isDeleting).toBe(false);
    });
  });

  describe('onAnimationEnd', () => {
    it('should call clearDeleteAnimation when delete-flash animation ends on deleting node', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: 'node-1',
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      act(() => {
        result.current.onAnimationEnd({
          animationName: 'delete-flash',
        } as React.AnimationEvent);
      });

      expect(mockClearDeleteAnimation).toHaveBeenCalled();
    });

    it('should not call clearDeleteAnimation for other animations', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: 'node-1',
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      act(() => {
        result.current.onAnimationEnd({
          animationName: 'flash-light',
        } as React.AnimationEvent);
      });

      expect(mockClearDeleteAnimation).not.toHaveBeenCalled();
    });

    it('should not call clearDeleteAnimation when node is not deleting', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      act(() => {
        result.current.onAnimationEnd({
          animationName: 'delete-flash',
        } as React.AnimationEvent);
      });

      expect(mockClearDeleteAnimation).not.toHaveBeenCalled();
    });

    it('should not call clearDeleteAnimation when different node is deleting', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: 'node-2',
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      act(() => {
        result.current.onAnimationEnd({
          animationName: 'delete-flash',
        } as React.AnimationEvent);
      });

      expect(mockClearDeleteAnimation).not.toHaveBeenCalled();
    });
  });

  describe('nodeRef', () => {
    it('should return a ref object', () => {
      mockUseStore.mockImplementation((selector) => {
        const state = {
          flashingNode: null,
          deletingNodeId: null,
          scrollToNodeId: null,
          actions: { clearDeleteAnimation: mockClearDeleteAnimation },
        };
        return selector(state as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const { result } = renderHook(() => useNodeEffects('node-1'));

      expect(result.current.nodeRef).toBeDefined();
      expect(result.current.nodeRef.current).toBe(null);
    });
  });
});
