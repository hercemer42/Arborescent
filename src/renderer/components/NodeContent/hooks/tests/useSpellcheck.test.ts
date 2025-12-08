import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellcheck } from '../useSpellcheck';
import * as spellcheck from '../../../../services/spellcheck';

describe('useSpellcheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no selection
    vi.spyOn(window, 'getSelection').mockReturnValue(null);
  });

  describe('captureWordAtCursor', () => {
    it('should capture word at cursor position', () => {
      const mockTextNode = document.createTextNode('hello world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 2, // In the middle of 'hello'
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      // buildSpellMenuItems should now have context to work with
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({ misspelled: false, suggestions: [] });
      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull(); // Word is correctly spelled
    });

    it('should handle no selection', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should handle selection with no range', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 0,
        getRangeAt: vi.fn(),
      } as unknown as Selection);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should handle non-text node selection', () => {
      const mockElement = document.createElement('div');
      const mockRange = {
        startContainer: mockElement,
        startOffset: 0,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
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

    it('should return null when word is spelled correctly', () => {
      const mockTextNode = document.createTextNode('hello world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 2,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({ misspelled: false, suggestions: [] });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });

    it('should return spell suggestions when word is misspelled', () => {
      const mockTextNode = document.createTextNode('helllo world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 3,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: ['hello', 'hallo'],
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
      expect(items).toHaveLength(2);
      expect(items![0].label).toBe('hello');
      expect(items![1].label).toBe('hallo');
    });

    it('should return "No suggestions" when misspelled with no suggestions', () => {
      const mockTextNode = document.createTextNode('xyzabc');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 3,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: [],
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
      expect(items).toHaveLength(1);
      expect(items![0].label).toBe('No suggestions');
      expect(items![0].disabled).toBe(true);
    });

    it('should replace word when suggestion is clicked', () => {
      const mockTextNode = document.createTextNode('helllo world');
      const parent = document.createElement('div');
      parent.appendChild(mockTextNode);

      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 3,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: ['hello'],
      });

      const dispatchSpy = vi.spyOn(parent, 'dispatchEvent');

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();

      // Click the suggestion
      act(() => {
        items![0].onClick?.();
      });

      expect(mockTextNode.textContent).toBe('hello world');
      expect(dispatchSpy).toHaveBeenCalled();
    });
  });

  describe('word boundary detection', () => {
    it('should detect word at start of text', () => {
      const mockTextNode = document.createTextNode('hello world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 0,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: ['hi'],
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
      expect(spellcheck.checkWord).toHaveBeenCalledWith('hello');
    });

    it('should detect word at end of text', () => {
      const mockTextNode = document.createTextNode('hello world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 11, // After 'world'
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: ['word'],
      });

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      const items = result.current.buildSpellMenuItems();
      expect(items).not.toBeNull();
      expect(spellcheck.checkWord).toHaveBeenCalledWith('world');
    });

    it('should handle cursor between words (at space)', () => {
      const mockTextNode = document.createTextNode('hello world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 5, // At the space
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      const { result } = renderHook(() => useSpellcheck());

      act(() => {
        result.current.captureWordAtCursor();
      });

      // Should still find 'hello' since we expand backward
      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({ misspelled: false, suggestions: [] });
      const items = result.current.buildSpellMenuItems();
      expect(items).toBeNull();
    });
  });
});
