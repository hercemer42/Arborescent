import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedbackActions } from '../useFeedbackActions';

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
  });

  describe('handleCancel', () => {
    it('should call finishCancel action', async () => {
      mockFinishCancel.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleCancel();
      });

      expect(mockFinishCancel).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when cancelling', async () => {
      mockFinishCancel.mockRejectedValue(new Error('Cancel failed'));

      const { result } = renderHook(() => useFeedbackActions());

      await expect(
        act(async () => {
          await result.current.handleCancel();
        })
      ).rejects.toThrow('Cancel failed');
    });
  });

  describe('handleAccept', () => {
    it('should call finishAccept action', async () => {
      mockFinishAccept.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleAccept();
      });

      expect(mockFinishAccept).toHaveBeenCalledTimes(1);
    });

    it('should not call actions if no active file path', async () => {
      // Override the mock for this test
      const { useFilesStore } = await vi.importMock<typeof import('../../../../store/files/filesStore')>(
        '../../../../store/files/filesStore'
      );
      vi.mocked(useFilesStore.getState).mockReturnValue({ activeFilePath: null } as ReturnType<typeof useFilesStore.getState>);

      const { result } = renderHook(() => useFeedbackActions());

      await act(async () => {
        await result.current.handleAccept();
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
          await result.current.handleAccept();
        })
      ).rejects.toThrow('Accept failed');
    });
  });
});
