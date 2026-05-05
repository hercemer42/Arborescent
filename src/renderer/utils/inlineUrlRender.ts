import { findInlineUrls, InlineUrlMatch } from './urlInlineDetection';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export const INLINE_URL_DATA_ATTR = 'data-inline-url';
export const INLINE_URL_CLASS = 'inline-url';

export function renderTextWithInlineUrls(text: string): {
  html: string;
  matches: InlineUrlMatch[];
} {
  const matches = findInlineUrls(text);
  if (matches.length === 0) {
    return { html: escapeHtml(text), matches };
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      parts.push(escapeHtml(text.slice(cursor, match.start)));
    }
    const safeUrl = escapeHtml(match.url);
    parts.push(
      `<a class="${INLINE_URL_CLASS}" href="${safeUrl}" ${INLINE_URL_DATA_ATTR}="${safeUrl}" rel="noopener noreferrer" target="_blank">${safeUrl}</a>`,
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    parts.push(escapeHtml(text.slice(cursor)));
  }
  return { html: parts.join(''), matches };
}
