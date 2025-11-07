import { describe, it, expect } from 'vitest';
import { generateMessageId } from '../messageId';

describe('messageId', () => {
  describe('generateMessageId', () => {
    it('should generate a UUID without prefix', () => {
      const id = generateMessageId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate a UUID with prefix', () => {
      const id = generateMessageId('test');

      expect(id).toMatch(/^test-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).not.toBe(id2);
    });

    it('should handle empty string prefix', () => {
      const id = generateMessageId('');

      // Empty string is falsy, so no prefix is added
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(id.includes('-')).toBe(true); // Has dashes from UUID format
      expect(id.startsWith('-')).toBe(false); // But no leading dash
    });

    it('should handle special characters in prefix', () => {
      const id = generateMessageId('plugin:test');

      expect(id).toMatch(/^plugin:test-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});
