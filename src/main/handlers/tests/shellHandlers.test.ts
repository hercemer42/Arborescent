import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl } from '../shellHandlers';

describe('isSafeExternalUrl', () => {
  it('allows http and https URLs', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
    expect(isSafeExternalUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('allows vscode: URIs', () => {
    expect(isSafeExternalUrl('vscode://file/Users/me/project/file.ts')).toBe(true);
  });

  it('allows mailto: URIs', () => {
    expect(isSafeExternalUrl('mailto:a@example.com')).toBe(true);
  });

  it('rejects file:// URIs by default', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects javascript: URIs', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects ftp and other schemes outside the allowlist', () => {
    expect(isSafeExternalUrl('ftp://example.com')).toBe(false);
    expect(isSafeExternalUrl('data:text/plain;base64,SGVsbG8=')).toBe(false);
  });

  it('rejects empty, oversized, or malformed input', () => {
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
    expect(isSafeExternalUrl('https://' + 'a'.repeat(3000))).toBe(false);
  });
});
