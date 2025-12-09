import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../urlHelpers';

describe('normalizeUrl', () => {
  describe('URL detection', () => {
    it('should return URLs with protocols unchanged', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
      expect(normalizeUrl('file:///path/to/file')).toBe('file:///path/to/file');
    });

    it('should add https:// to domain-like inputs', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
      expect(normalizeUrl('sub.example.co.uk')).toBe('https://sub.example.co.uk');
    });

    it('should add https:// to localhost', () => {
      expect(normalizeUrl('localhost')).toBe('https://localhost');
      expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000');
    });

    it('should add https:// to IP addresses', () => {
      expect(normalizeUrl('192.168.1.1')).toBe('https://192.168.1.1');
      expect(normalizeUrl('192.168.1.1:8080')).toBe('https://192.168.1.1:8080');
    });
  });

  describe('search query detection', () => {
    it('should redirect plain text to Ecosia search', () => {
      expect(normalizeUrl('hello world')).toBe('https://www.ecosia.org/search?q=hello%20world');
    });

    it('should redirect single words without TLD to Ecosia', () => {
      expect(normalizeUrl('react')).toBe('https://www.ecosia.org/search?q=react');
    });

    it('should handle special characters in search queries', () => {
      expect(normalizeUrl('what is 2+2?')).toBe('https://www.ecosia.org/search?q=what%20is%202%2B2%3F');
    });

    it('should trim whitespace before processing', () => {
      expect(normalizeUrl('  hello world  ')).toBe('https://www.ecosia.org/search?q=hello%20world');
    });
  });
});
