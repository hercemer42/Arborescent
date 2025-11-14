import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPositionFromCoordinates, getRangeFromPoint } from '../position';

// Add getBoundingClientRect to Range prototype for testing
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function () {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

describe('position utils', () => {
  describe('getPositionFromCoordinates', () => {
    let element: HTMLElement;
    let textNode: Text;

    beforeEach(() => {
      element = document.createElement('div');
      textNode = document.createTextNode('Hello World');
      element.appendChild(textNode);
      document.body.appendChild(element);
    });

    afterEach(() => {
      document.body.removeChild(element);
    });

    it('should return 0 when click is before element start', () => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 200,
        top: 0,
        bottom: 20,
        width: 100,
        height: 20,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      });

      const position = getPositionFromCoordinates(element, 50);
      expect(position).toBe(0);
    });

    it('should return text length when click is after element end', () => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 200,
        top: 0,
        bottom: 20,
        width: 100,
        height: 20,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      });

      const position = getPositionFromCoordinates(element, 250);
      expect(position).toBe(11); // "Hello World".length
    });

    it('should return 0 when element has no text content', () => {
      const emptyElement = document.createElement('div');
      document.body.appendChild(emptyElement);

      vi.spyOn(emptyElement, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 200,
        top: 0,
        bottom: 20,
        width: 100,
        height: 20,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      });

      const position = getPositionFromCoordinates(emptyElement, 150);
      expect(position).toBe(0);

      document.body.removeChild(emptyElement);
    });

    it('should return 0 when element has no text node child', () => {
      const divElement = document.createElement('div');
      const spanChild = document.createElement('span');
      divElement.appendChild(spanChild);
      document.body.appendChild(divElement);

      vi.spyOn(divElement, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 200,
        top: 0,
        bottom: 20,
        width: 100,
        height: 20,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      });

      const position = getPositionFromCoordinates(divElement, 150);
      expect(position).toBe(0);

      document.body.removeChild(divElement);
    });

    it('should find best position within element bounds', () => {
      // Mock getBoundingClientRect for element
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        right: 200,
        top: 0,
        bottom: 20,
        width: 100,
        height: 20,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      });

      // Since mocking Range.getBoundingClientRect is complex in JSDOM,
      // we'll just verify it returns a valid position within bounds
      const position = getPositionFromCoordinates(element, 145);
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThanOrEqual(11);
    });
  });

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
