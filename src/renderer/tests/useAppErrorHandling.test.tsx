import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppErrorHandling } from '../useAppErrorHandling';
import { useToastStore } from '../store/toast/toastStore';
import { logger } from '../services/logger';

// Mock dependencies
vi.mock('../store/toast/toastStore');
vi.mock('../services/logger', () => ({
  logger: {
    setToastCallback: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useAppErrorHandling', () => {
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToastStore).mockReturnValue(mockAddToast);
  });

  it('should set toast callback on logger', () => {
    renderHook(() => useAppErrorHandling());

    expect(logger.setToastCallback).toHaveBeenCalledWith(mockAddToast);
  });

  it('should register error handler with window.electron', () => {
    renderHook(() => useAppErrorHandling());

    expect(window.electron.setMainErrorHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should log errors from main process', () => {
    renderHook(() => useAppErrorHandling());

    // Get the callback that was passed to setMainErrorHandler
    const errorCallback = vi.mocked(window.electron.setMainErrorHandler).mock.calls[0][0];
    errorCallback('Test error message');

    expect(logger.error).toHaveBeenCalledWith('Test error message', undefined, 'Main Process', true);
  });

  it('should only register callbacks once', () => {
    const { rerender } = renderHook(() => useAppErrorHandling());

    const firstCallCount = vi.mocked(logger.setToastCallback).mock.calls.length;

    rerender();

    // Should not call again on rerender with same addToast
    expect(vi.mocked(logger.setToastCallback).mock.calls.length).toBe(firstCallCount);
  });

  it('should update callback when addToast changes', () => {
    const mockAddToast2 = vi.fn();
    vi.mocked(useToastStore).mockReturnValue(mockAddToast);

    const { rerender } = renderHook(() => useAppErrorHandling());

    // Change the mock to return a new function
    vi.mocked(useToastStore).mockReturnValue(mockAddToast2);
    rerender();

    expect(logger.setToastCallback).toHaveBeenCalledTimes(2);
    expect(logger.setToastCallback).toHaveBeenLastCalledWith(mockAddToast2);
  });
});
