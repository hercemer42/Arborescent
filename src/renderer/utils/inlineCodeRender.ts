import { escapeHtml } from './htmlEscape';

export const INLINE_CODE_CLASS = 'inline-code';
export const CODE_BLOCK_CLASS = 'code-block';

const TRIPLE_FENCE = '```';
const LANG_HINT_PATTERN = /^[a-zA-Z0-9_-]*$/;

export type CodeToken =
  | { type: 'text'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'codeBlock'; value: string };

interface BacktickRegion {
  start: number;
  end: number;
  type: 'inlineCode' | 'codeBlock';
  inner: string;
}

function findFences(text: string): BacktickRegion[] {
  const regions: BacktickRegion[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf(TRIPLE_FENCE, cursor);
    if (open === -1) break;
    const close = text.indexOf(TRIPLE_FENCE, open + TRIPLE_FENCE.length);
    if (close === -1) break;

    let inner = text.slice(open + TRIPLE_FENCE.length, close);
    const firstNewline = inner.indexOf('\n');
    if (firstNewline !== -1) {
      const firstLine = inner.slice(0, firstNewline);
      if (LANG_HINT_PATTERN.test(firstLine)) {
        inner = inner.slice(firstNewline + 1);
      }
    }
    if (inner.endsWith('\n')) {
      inner = inner.slice(0, -1);
    }

    regions.push({
      start: open,
      end: close + TRIPLE_FENCE.length,
      type: 'codeBlock',
      inner,
    });
    cursor = close + TRIPLE_FENCE.length;
  }
  return regions;
}

function findInlineSpans(segment: string, baseOffset: number): BacktickRegion[] {
  const regions: BacktickRegion[] = [];
  let cursor = 0;
  while (cursor < segment.length) {
    const open = segment.indexOf('`', cursor);
    if (open === -1) break;
    const close = segment.indexOf('`', open + 1);
    if (close === -1) break;
    const inner = segment.slice(open + 1, close);
    if (inner.length === 0 || inner.includes('\n')) {
      cursor = open + 1;
      continue;
    }
    regions.push({
      start: baseOffset + open,
      end: baseOffset + close + 1,
      type: 'inlineCode',
      inner,
    });
    cursor = close + 1;
  }
  return regions;
}

export function tokenizeBackticks(text: string): CodeToken[] {
  if (text.length === 0) return [];

  const fences = findFences(text);
  const regions: BacktickRegion[] = [];

  let scanCursor = 0;
  for (const fence of fences) {
    if (fence.start > scanCursor) {
      const segment = text.slice(scanCursor, fence.start);
      regions.push(...findInlineSpans(segment, scanCursor));
    }
    regions.push(fence);
    scanCursor = fence.end;
  }
  if (scanCursor < text.length) {
    const segment = text.slice(scanCursor);
    regions.push(...findInlineSpans(segment, scanCursor));
  }

  const tokens: CodeToken[] = [];
  let cursor = 0;
  for (const region of regions) {
    if (region.start > cursor) {
      tokens.push({ type: 'text', value: text.slice(cursor, region.start) });
    }
    tokens.push({ type: region.type, value: region.inner });
    cursor = region.end;
  }
  if (cursor < text.length) {
    tokens.push({ type: 'text', value: text.slice(cursor) });
  }
  return tokens;
}

export function renderTextWithInlineCode(text: string): { html: string; hasCode: boolean } {
  const tokens = tokenizeBackticks(text);
  let html = '';
  let hasCode = false;
  for (const token of tokens) {
    if (token.type === 'text') {
      html += escapeHtml(token.value);
    } else if (token.type === 'inlineCode') {
      html += `<code class="${INLINE_CODE_CLASS}">${escapeHtml(token.value)}</code>`;
      hasCode = true;
    } else {
      html += `<pre class="${CODE_BLOCK_CLASS}"><code>${escapeHtml(token.value)}</code></pre>`;
      hasCode = true;
    }
  }
  return { html, hasCode };
}
