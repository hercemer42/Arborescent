import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAtFirstLine,
  isAtLastLine,
  getCurrentCursorX,
} from '../multilineHelpers';

describe('multilineHelpers', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.contentEditable = 'true';
    element.style.lineHeight = '20px';
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  describe('isAtFirstLine', () => {
    it('should return true for empty element', () => {
      element.textContent = '';

      const result = isAtFirstLine(element);

      expect(result).toBe(true);
    });

    it('should return true for single-line element', () => {
      element.textContent = 'Short text';

      const result = isAtFirstLine(element);

      expect(result).toBe(true);
    });

    it('should return true when no selection', () => {
      element.textContent = 'Some text';

      // Clear selection
      const selection = window.getSelection();
      selection?.removeAllRanges();

      const result = isAtFirstLine(element);

      expect(result).toBe(true);
    });

    it('should return true for element with only whitespace', () => {
      element.textContent = '   ';

      const result = isAtFirstLine(element);

      expect(result).toBe(true);
    });
  });

  describe('isAtLastLine', () => {
    it('should return true for empty element', () => {
      element.textContent = '';

      const result = isAtLastLine(element);

      expect(result).toBe(true);
    });

    it('should return true for single-line element', () => {
      element.textContent = 'Short text';

      const result = isAtLastLine(element);

      expect(result).toBe(true);
    });

    it('should return true when no selection', () => {
      element.textContent = 'Some text';

      // Clear selection
      const selection = window.getSelection();
      selection?.removeAllRanges();

      const result = isAtLastLine(element);

      expect(result).toBe(true);
    });

    it('should return true for element with only whitespace', () => {
      element.textContent = '   ';

      const result = isAtLastLine(element);

      expect(result).toBe(true);
    });
  });

  describe('getCurrentCursorX', () => {
    it('should return 0 when no selection', () => {
      element.textContent = 'Some text';

      // Clear selection
      const selection = window.getSelection();
      selection?.removeAllRanges();

      const result = getCurrentCursorX();

      expect(result).toBe(0);
    });

    // Note: Testing getBoundingClientRect requires actual browser rendering
    // JSDOM doesn't fully implement Range.getBoundingClientRect()
    // These functions are tested through integration tests and manual testing
  });
});
