import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isFocusInTerminalOrBrowser } from '../selectionUtils';

describe('selectionUtils', () => {
  describe('isFocusInTerminalOrBrowser', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return false when no element is focused', () => {
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);
      expect(isFocusInTerminalOrBrowser()).toBe(false);
    });

    it('should return true when a webview is focused', () => {
      const mockElement = {
        tagName: 'WEBVIEW',
        closest: vi.fn(),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(true);
    });

    it('should return true when focus is inside terminal-panel', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn((selector: string) => selector === '.terminal-panel' ? {} : null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(true);
    });

    it('should return true when focus is inside browser-panel', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn((selector: string) => selector === '.browser-panel' ? {} : null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(true);
    });

    it('should return false when focus is inside feedback-panel', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn((selector: string) => selector === '.feedback-panel' ? {} : null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(false);
    });

    it('should return false when focus is in main workspace', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn(() => null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(false);
    });
  });
});
