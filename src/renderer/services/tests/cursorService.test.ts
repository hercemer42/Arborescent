import { describe, it, expect, beforeEach } from 'vitest';
import { getCursorPosition, setCursorPosition } from '../cursorService';

describe('cursor utilities', () => {
  let testElement: HTMLDivElement;

  beforeEach(() => {
    testElement = document.createElement('div');
    testElement.contentEditable = 'true';
    document.body.appendChild(testElement);
  });

  describe('getCursorPosition', () => {
    it('should return 0 when no selection exists', () => {
      const position = getCursorPosition(testElement);
      expect(position).toBe(0);
    });

    it('should return correct position in simple text', () => {
      testElement.textContent = 'Hello World';

      const range = document.createRange();
      const textNode = testElement.firstChild as Text;
      range.setStart(textNode, 5);
      range.collapse(true);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const position = getCursorPosition(testElement);
      expect(position).toBe(5);
    });

    it('should return position at end of text', () => {
      testElement.textContent = 'Test';

      const range = document.createRange();
      const textNode = testElement.firstChild as Text;
      range.setStart(textNode, 4);
      range.collapse(true);

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const position = getCursorPosition(testElement);
      expect(position).toBe(4);
    });
  });

  describe('setCursorPosition', () => {
    it('should set cursor at the beginning', () => {
      testElement.textContent = 'Hello World';

      setCursorPosition(testElement, 0);

      const position = getCursorPosition(testElement);
      expect(position).toBe(0);
    });

    it('should set cursor in the middle of text', () => {
      testElement.textContent = 'Hello World';

      setCursorPosition(testElement, 5);

      const position = getCursorPosition(testElement);
      expect(position).toBe(5);
    });

    it('should set cursor at the end of text', () => {
      testElement.textContent = 'Hello World';

      setCursorPosition(testElement, 11);

      const position = getCursorPosition(testElement);
      expect(position).toBe(11);
    });

    it('should handle position beyond text length', () => {
      testElement.textContent = 'Test';

      setCursorPosition(testElement, 100);

      const position = getCursorPosition(testElement);
      expect(position).toBe(4);
    });

    it('should handle empty element', () => {
      testElement.textContent = '';

      setCursorPosition(testElement, 0);

      const selection = window.getSelection();
      expect(selection?.rangeCount).toBeGreaterThan(0);
    });

    it('should handle element with multiple text nodes', () => {
      const span = document.createElement('span');
      span.textContent = 'Hello';
      testElement.appendChild(span);
      testElement.appendChild(document.createTextNode(' World'));

      setCursorPosition(testElement, 7);

      const position = getCursorPosition(testElement);
      expect(position).toBe(7);
    });
  });
});
