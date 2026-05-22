import { describe, it, expect } from 'vitest';
import {
  renderTextWithInlineCode,
  INLINE_CODE_CLASS,
  CODE_BLOCK_CLASS,
} from '../inlineCodeRender';

describe('renderTextWithInlineCode', () => {
  describe('plain text', () => {
    it('escapes plain text and reports no code when no backticks are present', () => {
      const { html, hasCode } = renderTextWithInlineCode('plain <text> & more');
      expect(html).toBe('plain &lt;text&gt; &amp; more');
      expect(hasCode).toBe(false);
    });

    it('returns empty string for empty input', () => {
      const { html, hasCode } = renderTextWithInlineCode('');
      expect(html).toBe('');
      expect(hasCode).toBe(false);
    });
  });

  describe('inline code (single backticks)', () => {
    it('wraps a backtick-delimited span in an inline code element', () => {
      const { html, hasCode } = renderTextWithInlineCode('use `foo` here');
      expect(html).toContain(`<code class="${INLINE_CODE_CLASS}">foo</code>`);
      expect(html.startsWith('use ')).toBe(true);
      expect(html.endsWith(' here')).toBe(true);
      expect(hasCode).toBe(true);
    });

    it('renders multiple inline code spans on the same line', () => {
      const { html } = renderTextWithInlineCode('call `foo` then `bar`');
      const matches = html.match(new RegExp(`<code class="${INLINE_CODE_CLASS}">`, 'g')) ?? [];
      expect(matches).toHaveLength(2);
      expect(html).toContain(`<code class="${INLINE_CODE_CLASS}">foo</code>`);
      expect(html).toContain(`<code class="${INLINE_CODE_CLASS}">bar</code>`);
    });

    it('escapes HTML special characters inside inline code', () => {
      const { html } = renderTextWithInlineCode('see `<div>&amp;</div>`');
      expect(html).toContain(
        `<code class="${INLINE_CODE_CLASS}">&lt;div&gt;&amp;amp;&lt;/div&gt;</code>`,
      );
    });

    it('renders an unmatched single backtick as literal text', () => {
      const { html, hasCode } = renderTextWithInlineCode('this ` is lonely');
      expect(html).toBe('this ` is lonely');
      expect(hasCode).toBe(false);
    });

    it('does not let an inline span cross a newline', () => {
      const { html, hasCode } = renderTextWithInlineCode('start `foo\nbar` end');
      expect(html).not.toContain(`<code class="${INLINE_CODE_CLASS}">`);
      expect(html).toContain('`foo');
      expect(html).toContain('bar`');
      expect(hasCode).toBe(false);
    });

    it('handles inline code at the start and end of the string', () => {
      const { html } = renderTextWithInlineCode('`foo` middle `bar`');
      expect(html.startsWith(`<code class="${INLINE_CODE_CLASS}">foo</code>`)).toBe(true);
      expect(html.endsWith(`<code class="${INLINE_CODE_CLASS}">bar</code>`)).toBe(true);
    });

    it('renders empty inline code (back-to-back backticks) as literal text', () => {
      const { html, hasCode } = renderTextWithInlineCode('empty `` here');
      expect(html).toContain('``');
      expect(hasCode).toBe(false);
    });

    it('treats a backtick after an empty pair as the opener of a new inline span', () => {
      const { html, hasCode } = renderTextWithInlineCode('``foo`');
      expect(html).toContain(`<code class="${INLINE_CODE_CLASS}">foo</code>`);
      expect(hasCode).toBe(true);
      expect(html.startsWith('`')).toBe(true);
    });
  });

  describe('fenced code blocks (triple backticks)', () => {
    it('wraps a multi-line fenced block in a pre/code structure', () => {
      const input = 'before\n```\nline one\nline two\n```\nafter';
      const { html, hasCode } = renderTextWithInlineCode(input);
      expect(html).toContain(`<pre class="${CODE_BLOCK_CLASS}">`);
      expect(html).toContain('<code>line one\nline two</code>');
      expect(html).toContain('</pre>');
      expect(hasCode).toBe(true);
    });

    it('preserves indentation and trailing whitespace inside a fenced block', () => {
      const input = '```\n  indented\n    deeper  \n```';
      const { html } = renderTextWithInlineCode(input);
      expect(html).toContain('<code>  indented\n    deeper  </code>');
    });

    it('strips a language tag on the opening fence line without displaying it', () => {
      const input = '```ts\nconst x = 1;\n```';
      const { html } = renderTextWithInlineCode(input);
      expect(html).toContain('<code>const x = 1;</code>');
      expect(html).not.toContain('ts\n');
      expect(html).not.toContain('ts<');
    });

    it('escapes HTML special characters inside a fenced block', () => {
      const input = '```\n<script>alert(1)</script>\n```';
      const { html } = renderTextWithInlineCode(input);
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('renders an unmatched opening fence as literal text', () => {
      const input = 'oops ```\nno close';
      const { html, hasCode } = renderTextWithInlineCode(input);
      expect(html).not.toContain(`<pre class="${CODE_BLOCK_CLASS}">`);
      expect(html).toContain('```');
      expect(hasCode).toBe(false);
    });

    it('renders consecutive fenced blocks as separate pre elements', () => {
      const input = '```\nfirst\n```\nmiddle\n```\nsecond\n```';
      const { html } = renderTextWithInlineCode(input);
      const matches = html.match(new RegExp(`<pre class="${CODE_BLOCK_CLASS}">`, 'g')) ?? [];
      expect(matches).toHaveLength(2);
      expect(html).toContain('<code>first</code>');
      expect(html).toContain('<code>second</code>');
    });

    it('treats triple backticks as a fence even when followed immediately by content', () => {
      const input = '```bash\necho hi\n```';
      const { html } = renderTextWithInlineCode(input);
      expect(html).toContain(`<pre class="${CODE_BLOCK_CLASS}">`);
      expect(html).toContain('<code>echo hi</code>');
    });
  });

  describe('composition of inline and fenced code', () => {
    it('renders inline code outside a fenced block while keeping the block intact', () => {
      const input = 'use `foo`\n```\nbar\n```\nthen `baz`';
      const { html } = renderTextWithInlineCode(input);
      const inlineMatches = html.match(new RegExp(`<code class="${INLINE_CODE_CLASS}">`, 'g')) ?? [];
      const blockMatches = html.match(new RegExp(`<pre class="${CODE_BLOCK_CLASS}">`, 'g')) ?? [];
      expect(inlineMatches).toHaveLength(2);
      expect(blockMatches).toHaveLength(1);
    });

    it('does not parse single backticks inside a fenced block as inline code', () => {
      const input = '```\nthis has `single` inside\n```';
      const { html } = renderTextWithInlineCode(input);
      expect(html).not.toContain(`<code class="${INLINE_CODE_CLASS}">`);
      expect(html).toContain('this has `single` inside');
    });
  });

  describe('exports', () => {
    it('exposes stable class name constants', () => {
      expect(INLINE_CODE_CLASS).toBe('inline-code');
      expect(CODE_BLOCK_CLASS).toBe('code-block');
    });
  });
});
