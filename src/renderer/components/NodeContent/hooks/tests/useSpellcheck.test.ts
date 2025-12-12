import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellcheck } from '../useSpellcheck';
import { useSpellcheckStore } from '../../../../store/spellcheck/spellcheckStore';

function mockCaretRangeFromPoint(range: Range | null) {
  Object.defineProperty(document, 'caretRangeFromPoint', {
    value: vi.fn().mockReturnValue(range),
    writable: true,
    configurable: true,
  });
}

function createMockRange(textNode: Text, offset: number): Range {
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);
  return range;
}

describe('useSpellcheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaretRangeFromPoint(null);
    useSpellcheckStore.getState().clear();
  });

  describe('captureWordAtPoint', () => {
    it('should capture word at click position', () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 2);
      mockCaretRangeFromPoint(range);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should handle no range at point', () => {
      mockCaretRangeFromPoint(null);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should handle non-text node at point', () => {
      const mockElement = document.createElement('div');
      const range = document.createRange();
      range.setStart(mockElement, 0);
      range.collapse(true);
      mockCaretRangeFromPoint(range);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });
  });

  describe('buildSpellMenuItems', () => {
    it('should return null when no word is captured', () => {
      const { result } = renderHook(() => useSpellcheck());
      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should return null when store has no misspelled word', () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 2);
      mockCaretRangeFromPoint(range);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should return null when captured word does not match store misspelled word', () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 2);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('different', ['suggestion']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should return suggestions when captured word matches store misspelled word', () => {
      const mockTextNode = document.createTextNode('helllo world');
      const range = createMockRange(mockTextNode, 3);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('helllo', ['hello', 'hallo']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
      expect(items).toHaveLength(2);
      expect(items![0].label).toBe('hello');
      expect(items![1].label).toBe('hallo');
    });

    it('should match case-insensitively', () => {
      const mockTextNode = document.createTextNode('Helllo world');
      const range = createMockRange(mockTextNode, 3);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('helllo', ['hello']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
      expect(items![0].label).toBe('hello');
    });

    it('should return "No suggestions" when misspelled with no suggestions', () => {
      const mockTextNode = document.createTextNode('xyzabc');
      const range = createMockRange(mockTextNode, 3);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('xyzabc', []);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items![0].label).toBe('No suggestions');
      expect(items![0].disabled).toBe(true);
    });

    it('should not clear store after building menu items (cleared at context menu start)', () => {
      const mockTextNode = document.createTextNode('helllo world');
      const range = createMockRange(mockTextNode, 3);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('helllo', ['hello']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      result.current.buildSpellMenuItems();

      // Store is NOT cleared here - it's cleared at context menu start instead
      expect(useSpellcheckStore.getState().misspelledWord).toBe('helllo');
      expect(useSpellcheckStore.getState().suggestions).toEqual(['hello']);
    });

    it('should call replaceMisspelling when suggestion is clicked', () => {
      const mockTextNode = document.createTextNode('helllo world');
      const range = createMockRange(mockTextNode, 3);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('helllo', ['hello']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items![0].label).toBe('hello');

      act(() => {
        items![0].onClick?.();
      });

      expect(window.electron.replaceMisspelling).toHaveBeenCalledWith('hello');
    });
  });

  describe('word boundary detection', () => {
    it('should detect word at start of text', () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 0);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('hello', ['hi']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
    });

    it('should detect word at end of text', () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 11);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('world', ['word']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
    });

    it('should detect contractions as single words', () => {
      const mockTextNode = document.createTextNode("it doesn't work");
      const range = createMockRange(mockTextNode, 6);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions("doesn't", ['does not']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
    });

    it('should strip leading apostrophes from quoted words', () => {
      const mockTextNode = document.createTextNode("the word 'hello' is here");
      const range = createMockRange(mockTextNode, 10);
      mockCaretRangeFromPoint(range);

      act(() => {
        useSpellcheckStore.getState().setSuggestions('hello', ['hi']);
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtPoint(100, 50);
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
    });
  });
});
