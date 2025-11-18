import { describe, it, expect, vi } from 'vitest';
import { getRangeFromPoint } from '../position';

describe('position utils', () => {
  describe('getRangeFromPoint', () => {
    it('should return null when caretPositionFromPoint is not supported', () => {
      const result = getRangeFromPoint(100, 100);
      expect(result).toBeNull();
    });

    it('should return null when caretPositionFromPoint returns null', () => {
      const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };

      doc.caretPositionFromPoint = vi.fn().mockReturnValue(null);

      const result = getRangeFromPoint(100, 100);
      expect(result).toBeNull();
    });

    it('should create range from caret position', () => {
      const element = document.createElement('div');
      const textNode = document.createTextNode('Test');
      element.appendChild(textNode);
      document.body.appendChild(element);

      const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };

      doc.caretPositionFromPoint = vi.fn().mockReturnValue({
        offsetNode: textNode,
        offset: 2,
      });

      const result = getRangeFromPoint(100, 100);

      expect(result).not.toBeNull();
      expect(result?.startContainer).toBe(textNode);
      expect(result?.startOffset).toBe(2);
      expect(result?.collapsed).toBe(true);

      document.body.removeChild(element);
    });

    it('should handle different positions', () => {
      const element = document.createElement('div');
      const textNode = document.createTextNode('Hello World');
      element.appendChild(textNode);
      document.body.appendChild(element);

      const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };

      doc.caretPositionFromPoint = vi.fn().mockReturnValue({
        offsetNode: textNode,
        offset: 6,
      });

      const result = getRangeFromPoint(150, 50);

      expect(result).not.toBeNull();
      expect(result?.startOffset).toBe(6);

      document.body.removeChild(element);
    });
  });
});
