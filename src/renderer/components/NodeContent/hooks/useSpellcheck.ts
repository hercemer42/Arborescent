import { useRef, useCallback } from 'react';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { initSpellcheck, checkWordFast, getSuggestions } from '../../../services/spellcheck';

// Initialize spellcheck on module load
initSpellcheck();

interface WordContext {
  word: string;
  start: number;
  end: number;
  textNode: Text;
}

/**
 * Get the word at the current cursor position
 */
function getWordAtCursor(): WordContext | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE || !textNode.textContent) return null;

  const text = textNode.textContent;
  const offset = range.startOffset;

  // Find word boundaries
  let start = offset;
  let end = offset;
  while (start > 0 && /\w/.test(text[start - 1])) start--;
  while (end < text.length && /\w/.test(text[end])) end++;

  if (start >= end) return null;

  return {
    word: text.slice(start, end),
    start,
    end,
    textNode: textNode as Text,
  };
}

/**
 * Build menu items for spelling suggestions
 */
function buildSuggestionItems(
  suggestions: string[],
  wordContext: WordContext
): ContextMenuItem[] {
  if (suggestions.length === 0) {
    return [{
      label: 'No suggestions',
      disabled: true,
      onClick: () => {},
    }];
  }

  return suggestions.map((suggestion) => ({
    label: suggestion,
    onClick: () => {
      const { textNode, start, end } = wordContext;
      if (textNode.textContent) {
        const before = textNode.textContent.slice(0, start);
        const after = textNode.textContent.slice(end);
        textNode.textContent = before + suggestion + after;
        textNode.parentElement?.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
  }));
}

/**
 * Hook for spellcheck functionality in context menus.
 * Captures the word at cursor on right-click and provides spell suggestions.
 */
export function useSpellcheck() {
  const wordContextRef = useRef<WordContext | null>(null);

  /**
   * Capture the word at cursor position. Call this in handleContextMenu.
   */
  const captureWordAtCursor = useCallback(() => {
    wordContextRef.current = getWordAtCursor();
  }, []);

  /**
   * Build spell menu items synchronously (nspell is fast).
   */
  const buildSpellMenuItems = useCallback((): ContextMenuItem[] | null => {
    const wordContext = wordContextRef.current;
    if (!wordContext) return null;

    const misspelled = checkWordFast(wordContext.word);
    if (!misspelled) return null;

    const suggestions = getSuggestions(wordContext.word);
    return buildSuggestionItems(suggestions, wordContext);
  }, []);

  return {
    captureWordAtCursor,
    buildSpellMenuItems,
    // Keep these for API compatibility, but they're no longer needed
    suggestionsVersion: 0,
    precomputeCurrentWord: () => {},
  };
}
