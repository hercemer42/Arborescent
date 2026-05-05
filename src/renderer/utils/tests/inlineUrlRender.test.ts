import { describe, it, expect } from 'vitest';
import { renderTextWithInlineUrls } from '../inlineUrlRender';

describe('renderTextWithInlineUrls', () => {
  it('escapes plain text and returns no matches when no URL is present', () => {
    const { html, matches } = renderTextWithInlineUrls('plain <text> & more');
    expect(html).toBe('plain &lt;text&gt; &amp; more');
    expect(matches).toEqual([]);
  });

  it('wraps an http URL in an inline-url anchor', () => {
    const { html } = renderTextWithInlineUrls('go https://a.com here');
    expect(html).toContain('<a class="inline-url"');
    expect(html).toContain('href="https://a.com"');
    expect(html).toContain('data-inline-url="https://a.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html.startsWith('go ')).toBe(true);
    expect(html.endsWith(' here')).toBe(true);
  });

  it('wraps an allowlisted vscode URL in an inline-url anchor', () => {
    const { html } = renderTextWithInlineUrls('open vscode://file/foo end');
    expect(html).toContain('href="vscode://file/foo"');
  });

  it('renders file:// as plain text without an anchor', () => {
    const { html } = renderTextWithInlineUrls('see file:///etc/passwd here');
    expect(html).not.toContain('<a ');
    expect(html).toContain('file:///etc/passwd');
  });

  it('renders multiple URLs as separate anchors', () => {
    const { html } = renderTextWithInlineUrls('https://a.com and https://b.com');
    expect(html.match(/<a class="inline-url"/g) ?? []).toHaveLength(2);
  });

  it('escapes ampersands in URL query strings', () => {
    const { html } = renderTextWithInlineUrls('https://a.com/x?a=1&b=2');
    expect(html).toContain('href="https://a.com/x?a=1&amp;b=2"');
  });
});
