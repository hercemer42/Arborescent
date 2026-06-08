import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedbackActions } from '../useFeedbackActions';
import { useReviewCollapseStore, selectReviewCollapseExpanded } from '../../../../store/reviewCollapse/reviewCollapseStore';

const mockFinishCancel = vi.fn();
const mockFinishAccept = vi.fn();

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: {
    getState: vi.fn(() => ({
      activeFilePath: '/test/file.arbo',
    })),
  },
}));

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(() => ({
      getState: vi.fn(() => ({
        actions: {
          finishCancel: mockFinishCancel,
          finishAccept: mockFinishAccept,
        },
      })),
    })),
  },
}));

describe('useFeedbackActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReviewCollapseStore.setState({ byReview: {} });
  });

  describe('handleCancel', () => {
    it('should call finishCancel action with the reviewed node id', async () => {
      mockFinishCancel.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleCancel('node-1');
      });

      expect(mockFinishCancel).toHaveBeenCalledTimes(1);
      expect(mockFinishCancel).toHaveBeenCalledWith('node-1');
    });

    it('should handle errors when cancelling', async () => {
      mockFinishCancel.mockRejectedValue(new Error('Cancel failed'));

      const { result } = renderHook(() => useFeedbackActions());

      await expect(
        act(async () => {
          await result.current.handleCancel('node-1');
        })
      ).rejects.toThrow('Cancel failed');
    });

    it('clears the per-view collapse state for the review after cancelling', async () => {
      mockFinishCancel.mockResolvedValue(undefined);
      useReviewCollapseStore.getState().setExpanded('node-1', 'main', 'prop-root', false);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleCancel('node-1');
      });

      expect(selectReviewCollapseExpanded(useReviewCollapseStore.getState(), 'node-1', 'main', 'prop-root')).toBeUndefined();
    });
  });

  describe('handleAccept', () => {
    it('should call finishAccept action with the reviewed node id', async () => {
      mockFinishAccept.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleAccept('node-1');
      });

      expect(mockFinishAccept).toHaveBeenCalledTimes(1);
      expect(mockFinishAccept).toHaveBeenCalledWith('node-1');
    });

    it('should not call actions if no active file path', async () => {
      // Override the mock for this test
      const { useFilesStore } = await vi.importMock<typeof import('../../../../store/files/filesStore')>(
        '../../../../store/files/filesStore'
      );
      vi.mocked(useFilesStore.getState).mockReturnValue({ activeFilePath: null } as ReturnType<typeof useFilesStore.getState>);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleAccept('node-1');
      });

      expect(mockFinishAccept).not.toHaveBeenCalled();

      // Restore
      vi.mocked(useFilesStore.getState).mockReturnValue({ activeFilePath: '/test/file.arbo' } as ReturnType<typeof useFilesStore.getState>);
    });

    it('should handle errors during accept gracefully', async () => {
      mockFinishAccept.mockRejectedValue(new Error('Accept failed'));

      const { result } = renderHook(() => useFeedbackActions());

      await expect(
        act(async () => {
          await result.current.handleAccept('node-1');
        })
      ).rejects.toThrow('Accept failed');
    });

    it('clears the per-view collapse state for the review after accepting', async () => {
      mockFinishAccept.mockResolvedValue(undefined);
      useReviewCollapseStore.getState().setExpanded('node-1', 'zoom', 'prop-root', true);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleAccept('node-1');
      });

      expect(selectReviewCollapseExpanded(useReviewCollapseStore.getState(), 'node-1', 'zoom', 'prop-root')).toBeUndefined();
    });
  });
});
