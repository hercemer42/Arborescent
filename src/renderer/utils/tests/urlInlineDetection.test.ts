import { describe, it, expect } from 'vitest';
import { findInlineUrls } from '../urlInlineDetection';

describe('findInlineUrls', () => {
  it('detects http URL anywhere in node text', () => {
    const result = findInlineUrls('go to http://example.com now');
    expect(result).toEqual([{ url: 'http://example.com', start: 6, end: 24 }]);
  });

  it('detects https URL anywhere in node text', () => {
    const result = findInlineUrls('see https://a.b/c please');
    expect(result.map((m) => m.url)).toEqual(['https://a.b/c']);
  });

  it('detects URL at the start, middle, and end of the string', () => {
    expect(findInlineUrls('https://a.com').map((m) => m.url)).toEqual(['https://a.com']);
    expect(findInlineUrls('x https://a.com x').map((m) => m.url)).toEqual(['https://a.com']);
    expect(findInlineUrls('end at https://a.com').map((m) => m.url)).toEqual(['https://a.com']);
  });

  it('detects multiple URLs in the same string', () => {
    const result = findInlineUrls('https://a.com and https://b.com');
    expect(result.map((m) => m.url)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('detects allowlisted scheme vscode://', () => {
    const result = findInlineUrls('open vscode://file/foo here');
    expect(result.map((m) => m.url)).toEqual(['vscode://file/foo']);
  });

  it('detects allowlisted scheme mailto:', () => {
    const result = findInlineUrls('email mailto:a@b.com please');
    expect(result.map((m) => m.url)).toEqual(['mailto:a@b.com']);
  });

  it('does not detect file:// by default', () => {
    expect(findInlineUrls('see file:///etc/passwd here')).toEqual([]);
  });

  it('does not detect unknown or non-allowlisted schemes', () => {
    expect(findInlineUrls('try ftp://x.com or javascript:alert(1)')).toEqual([]);
  });

  it('strips trailing terminator punctuation from the match', () => {
    expect(findInlineUrls('see https://a.com.').map((m) => m.url)).toEqual(['https://a.com']);
    expect(findInlineUrls('list https://a.com, then').map((m) => m.url)).toEqual(['https://a.com']);
    expect(findInlineUrls('items https://a.com] now').map((m) => m.url)).toEqual(['https://a.com']);
  });

  it('handles surrounding parentheses with the URL itself in the match', () => {
    expect(findInlineUrls('check (https://a.com) ok').map((m) => m.url)).toEqual(['https://a.com']);
  });

  it('keeps balanced parentheses inside the URL', () => {
    expect(
      findInlineUrls('see https://en.wikipedia.org/wiki/Foo_(bar) here').map((m) => m.url),
    ).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
  });

  it('returns no matches for empty input', () => {
    expect(findInlineUrls('')).toEqual([]);
  });

  it('returns offsets usable for in-place substring wrapping', () => {
    const text = 'hi https://a.com bye';
    const [m] = findInlineUrls(text);
    expect(text.slice(m.start, m.end)).toBe('https://a.com');
  });
});
