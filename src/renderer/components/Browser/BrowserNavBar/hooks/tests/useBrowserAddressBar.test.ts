import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBrowserAddressBar } from '../useBrowserAddressBar';
import { BrowserTab } from '../../../../../store/browser/browserStore';

describe('useBrowserAddressBar', () => {
  const mockTabs: BrowserTab[] = [
    { id: 'tab-1', url: 'https://example.com', title: 'Example' },
    { id: 'tab-2', url: 'https://other.com', title: 'Other' },
  ];

  const mockLoadURL = vi.fn().mockResolvedValue(undefined);
  const mockGetURL = vi.fn().mockReturnValue('https://navigated.com');

  const mockWebview = {
    loadURL: mockLoadURL,
    getURL: mockGetURL,
  } as unknown as HTMLWebViewElement;

  const defaultOptions = {
    activeTabId: 'tab-1' as string | null,
    tabs: mockTabs,
    getActiveWebview: () => mockWebview,
  };

  describe('addressBarValue derivation', () => {
    it('should show active tab URL when not editing', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      expect(result.current.addressBarValue).toBe('https://example.com');
    });

    it('should update when active tab changes', () => {
      const { result, rerender } = renderHook(
        (props) => useBrowserAddressBar(props),
        { initialProps: defaultOptions },
      );

      expect(result.current.addressBarValue).toBe('https://example.com');

      rerender({ ...defaultOptions, activeTabId: 'tab-2' });

      expect(result.current.addressBarValue).toBe('https://other.com');
    });

    it('should update when tab URL changes', () => {
      const { result, rerender } = renderHook(
        (props) => useBrowserAddressBar(props),
        { initialProps: defaultOptions },
      );

      expect(result.current.addressBarValue).toBe('https://example.com');

      const updatedTabs = [
        { id: 'tab-1', url: 'https://example.com/page', title: 'Example Page' },
        ...mockTabs.slice(1),
      ];
      rerender({ ...defaultOptions, tabs: updatedTabs });

      expect(result.current.addressBarValue).toBe('https://example.com/page');
    });

    it('should return empty string when no active tab', () => {
      const { result } = renderHook(() =>
        useBrowserAddressBar({ ...defaultOptions, activeTabId: null }),
      );

      expect(result.current.addressBarValue).toBe('');
    });

    it('should show editing value when editing', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('typed text');
      });

      expect(result.current.addressBarValue).toBe('typed text');
    });

    it('should revert to tab URL when editing stops', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('typed text');
      });

      expect(result.current.addressBarValue).toBe('typed text');

      act(() => {
        result.current.setIsEditingAddress(false);
      });

      expect(result.current.addressBarValue).toBe('https://example.com');
    });
  });

  describe('handleAddressBarSubmit', () => {
    it('should call loadURL with normalized URL', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('example.com');
      });

      act(() => {
        result.current.handleAddressBarSubmit();
      });

      expect(mockLoadURL).toHaveBeenCalledWith('https://example.com');
    });

    it('should stop editing after submit', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('example.com');
      });

      act(() => {
        result.current.handleAddressBarSubmit();
      });

      expect(result.current.isEditingAddress).toBe(false);
    });

    it('should not navigate when no webview', () => {
      const { result } = renderHook(() =>
        useBrowserAddressBar({ ...defaultOptions, getActiveWebview: () => null }),
      );

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('example.com');
      });

      act(() => {
        result.current.handleAddressBarSubmit();
      });

      expect(mockLoadURL).not.toHaveBeenCalled();
    });

    it('should prevent form event default', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));
      const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('example.com');
      });

      act(() => {
        result.current.handleAddressBarSubmit(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('updateAddressBarFromWebview', () => {
    it('should update editing value from webview URL when not editing', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      act(() => {
        result.current.updateAddressBarFromWebview();
      });

      expect(mockGetURL).toHaveBeenCalled();
    });

    it('should not update when user is editing', () => {
      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      act(() => {
        result.current.setIsEditingAddress(true);
        result.current.setAddressBarValue('user typing');
      });

      act(() => {
        result.current.updateAddressBarFromWebview();
      });

      expect(result.current.addressBarValue).toBe('user typing');
    });

    it('should handle webview not ready', () => {
      mockGetURL.mockImplementationOnce(() => {
        throw new Error('Webview not ready');
      });

      const { result } = renderHook(() => useBrowserAddressBar(defaultOptions));

      expect(() => {
        act(() => {
          result.current.updateAddressBarFromWebview();
        });
      }).not.toThrow();
    });
  });
});
