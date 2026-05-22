import { useCallback, useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';
import {
  renderTextWithInlineUrls,
  INLINE_URL_CLASS,
  INLINE_URL_DATA_ATTR,
} from '../../../utils/inlineUrlRender';
import {
  tokenizeBackticks,
  INLINE_CODE_CLASS,
  CODE_BLOCK_CLASS,
} from '../../../utils/inlineCodeRender';
import { escapeHtml } from '../../../utils/htmlEscape';
import { useToastStore } from '../../../store/toast/toastStore';

interface UseRichNodeContentOptions {
  isLink: boolean;
  isSelected: boolean;
  hasHighlightedContent: boolean;
}

function renderRichHtml(content: string): { html: string; hasRichContent: boolean } {
  const tokens = tokenizeBackticks(content);
  let html = '';
  let hasRichContent = false;

  for (const token of tokens) {
    if (token.type === 'text') {
      const result = renderTextWithInlineUrls(token.value);
      html += result.html;
      if (result.matches.length > 0) hasRichContent = true;
    } else if (token.type === 'inlineCode') {
      html += `<code class="${INLINE_CODE_CLASS}">${escapeHtml(token.value)}</code>`;
      hasRichContent = true;
    } else {
      html += `<pre class="${CODE_BLOCK_CLASS}"><code>${escapeHtml(token.value)}</code></pre>`;
      hasRichContent = true;
    }
  }

  return { html, hasRichContent };
}

export function useRichNodeContent(node: TreeNode, options: UseRichNodeContentOptions) {
  const { isLink, isSelected, hasHighlightedContent } = options;

  const richHtml = useMemo(() => {
    if (isLink || isSelected || hasHighlightedContent) return null;
    const result = renderRichHtml(node.content);
    return result.hasRichContent ? result.html : null;
  }, [isLink, isSelected, hasHighlightedContent, node.content]);

  const handleRichClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
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

  return { richHtml, handleRichClick };
}
