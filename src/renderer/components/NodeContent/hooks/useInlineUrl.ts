import { useCallback, useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';
import {
  renderTextWithInlineUrls,
  INLINE_URL_CLASS,
  INLINE_URL_DATA_ATTR,
} from '../../../utils/inlineUrlRender';
import { useToastStore } from '../../../store/toast/toastStore';

interface UseInlineUrlOptions {
  isLink: boolean;
  isSelected: boolean;
  hasHighlightedContent: boolean;
}

export function useInlineUrl(node: TreeNode, options: UseInlineUrlOptions) {
  const { isLink, isSelected, hasHighlightedContent } = options;

  const inlineUrlHtml = useMemo(() => {
    if (isLink || isSelected || hasHighlightedContent) return null;
    const result = renderTextWithInlineUrls(node.content);
    return result.matches.length > 0 ? result.html : null;
  }, [isLink, isSelected, hasHighlightedContent, node.content]);

  const handleInlineUrlClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest(`a.${INLINE_URL_CLASS}`);
    if (!anchor) return;
    event.preventDefault();
    event.stopPropagation();
    const url = anchor.getAttribute(INLINE_URL_DATA_ATTR);
    if (!url) return;
    window.electron.openExternal(url).catch(() => {
      useToastStore.getState().addToast('Failed to open link', 'error');
    });
  }, []);

  return { inlineUrlHtml, handleInlineUrlClick };
}
