import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRichNodeContent } from '../useRichNodeContent';
import type { TreeNode } from '@shared/types';

const mockAddToast = vi.fn();

vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: vi.fn(() => ({ addToast: mockAddToast })) },
}));

describe('useRichNodeContent', () => {
  const urlNode: TreeNode = {
    id: 'n1',
    content: 'go https://example.com here',
    children: [],
    metadata: { status: 'pending' },
  };

  const plainNode: TreeNode = {
    id: 'n2',
    content: 'no rich content here',
    children: [],
    metadata: { status: 'pending' },
  };

  const inlineCodeNode: TreeNode = {
    id: 'n3',
    content: 'run `npm test` now',
    children: [],
    metadata: { status: 'pending' },
  };

  const fencedCodeNode: TreeNode = {
    id: 'n4',
    content: 'see\n```\nconst x = 1;\n```\nyep',
    children: [],
    metadata: { status: 'pending' },
  };

  const codeAndUrlNode: TreeNode = {
    id: 'n5',
    content: 'docs at https://example.com use `flag` to enable',
    children: [],
    metadata: { status: 'pending' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns rich HTML for an unselected, non-link node with URLs', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toContain('<a class="inline-url"');
    expect(result.current.richHtml).toContain('href="https://example.com"');
  });

  it('returns rich HTML wrapping inline backtick spans in inline-code elements', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(inlineCodeNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toContain('<code class="inline-code">npm test</code>');
  });

  it('returns rich HTML wrapping fenced triple-backtick blocks in code-block pre elements', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(fencedCodeNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toContain('<pre class="code-block">');
    expect(result.current.richHtml).toContain('<code>const x = 1;</code>');
  });

  it('renders inline code and URLs together in the same node', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(codeAndUrlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toContain('<a class="inline-url"');
    expect(result.current.richHtml).toContain('<code class="inline-code">flag</code>');
  });

  it('returns null when the node is selected', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: false, isSelected: true, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toBeNull();
  });

  it('returns null when the node is a link node', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: true, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toBeNull();
  });

  it('returns null when search highlight is active', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: true }),
    );
    expect(result.current.richHtml).toBeNull();
  });

  it('returns null when the node has neither URLs nor backticks', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(plainNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toBeNull();
  });

  it('returns null for an inline-code node when selected (raw backticks must remain editable)', () => {
    const { result } = renderHook(() =>
      useRichNodeContent(inlineCodeNode, { isLink: false, isSelected: true, hasHighlightedContent: false }),
    );
    expect(result.current.richHtml).toBeNull();
  });

  it('handleRichClick invokes openExternal with the matched URL and stops propagation', () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
      openExternal,
    };

    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
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

    result.current.handleRichClick(event);

    expect(openExternal).toHaveBeenCalledWith('https://example.com');
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('handleRichClick is a no-op when the click target is not an anchor', () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
      openExternal,
    };

    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );

    const span = document.createElement('span');
    const stopPropagation = vi.fn();
    const event = {
      target: span,
      stopPropagation,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLDivElement>;

    result.current.handleRichClick(event);

    expect(openExternal).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('toasts an error when openExternal rejects', async () => {
    const openExternal = vi.fn().mockRejectedValue(new Error('boom'));
    (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
      openExternal,
    };

    const { result } = renderHook(() =>
      useRichNodeContent(urlNode, { isLink: false, isSelected: false, hasHighlightedContent: false }),
    );

    const anchor = document.createElement('a');
    anchor.classList.add('inline-url');
    anchor.setAttribute('data-inline-url', 'https://example.com');

    result.current.handleRichClick({
      target: anchor,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLDivElement>);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAddToast).toHaveBeenCalledWith('Failed to open link', 'error');
  });
});
