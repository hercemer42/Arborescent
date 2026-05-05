import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInlineUrl } from '../useInlineUrl';
import type { TreeNode } from '@shared/types';

const mockAddToast = vi.fn();

vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: vi.fn(() => ({ addToast: mockAddToast })) },
}));

describe('useInlineUrl', () => {
  const urlNode: TreeNode = {
    id: 'n1',
    content: 'go https://example.com here',
    children: [],
    metadata: { status: 'pending' },
  };

  const plainNode: TreeNode = {
    id: 'n2',
    content: 'no urls here',
    children: [],
    metadata: { status: 'pending' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns inline-URL HTML for an unselected, non-link node with URLs', () => {
    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.inlineUrlHtml).toContain('<a class="inline-url"');
    expect(result.current.inlineUrlHtml).toContain('href="https://example.com"');
  });

  it('returns null when the node is selected', () => {
    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: false, isSelected: true, hasHighlightedContent: false }),
    );
    expect(result.current.inlineUrlHtml).toBeNull();
  });

  it('returns null when the node is a link node', () => {
    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: true, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.inlineUrlHtml).toBeNull();
  });

  it('returns null when search highlight is active', () => {
    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: true }),
    );
    expect(result.current.inlineUrlHtml).toBeNull();
  });

  it('returns null when the node has no URLs', () => {
    const { result } = renderHook(() =>
      useInlineUrl(plainNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.inlineUrlHtml).toBeNull();
  });

  it('handleInlineUrlClick invokes openExternal with the matched URL and stops propagation', () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
      openExternal,
    };

    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );

    const anchor = document.createElement('a');
    anchor.classList.add('inline-url');
    anchor.setAttribute('data-inline-url', 'https://example.com');

    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    const event = {
      target: anchor,
      stopPropagation,
      preventDefault,
    } as unknown as React.MouseEvent<HTMLDivElement>;

    result.current.handleInlineUrlClick(event);

    expect(openExternal).toHaveBeenCalledWith('https://example.com');
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('handleInlineUrlClick is a no-op when the click target is not an anchor', () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
      openExternal,
    };

    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );

    const span = document.createElement('span');
    const stopPropagation = vi.fn();
    const event = {
      target: span,
      stopPropagation,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLDivElement>;

    result.current.handleInlineUrlClick(event);

    expect(openExternal).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('toasts an error when openExternal rejects', async () => {
    const openExternal = vi.fn().mockRejectedValue(new Error('boom'));
    (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
      openExternal,
    };

    const { result } = renderHook(() =>
      useInlineUrl(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );

    const anchor = document.createElement('a');
    anchor.classList.add('inline-url');
    anchor.setAttribute('data-inline-url', 'https://example.com');

    result.current.handleInlineUrlClick({
      target: anchor,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLDivElement>);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAddToast).toHaveBeenCalledWith('Failed to open link', 'error');
  });
});
