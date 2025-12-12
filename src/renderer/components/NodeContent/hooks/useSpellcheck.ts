import { useRef, useCallback } from 'react';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { useSpellcheckStore } from '../../../store/spellcheck/spellcheckStore';
import { getRangeFromPoint } from '../../../utils/position';

function isWordChar(char: string): boolean {
  return /\w/.test(char) || char === "'";
}

function getWordFromRange(range: Range): string | null {
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE || !textNode.textContent) return null;

  const text = textNode.textContent;
  const offset = range.startOffset;

  let start = offset;
  let end = offset;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;

  if (start >= end) return null;

  let word = text.slice(start, end);
  while (word.startsWith("'")) word = word.slice(1);
  while (word.endsWith("'")) word = word.slice(0, -1);

  return word.length > 0 ? word : null;
}

function getWordAtPoint(x: number, y: number): string | null {
  const range = getRangeFromPoint(x, y);
  if (!range) return null;
  return getWordFromRange(range);
}

function buildSuggestionItems(
  suggestions: string[]
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
      // Use Electron's replaceMisspelling API for proper spellcheck state handling
      window.electron.replaceMisspelling(suggestion);
    },
  }));
}

export function useSpellcheck() {
  const capturedWordRef = useRef<string | null>(null);

  const captureWordAtPoint = useCallback((x: number, y: number) => {
    capturedWordRef.current = getWordAtPoint(x, y);
  }, []);

  const buildSpellMenuItems = useCallback((): ContextMenuItem[] | null => {
    const capturedWord = capturedWordRef.current;
    if (!capturedWord) return null;

    // Read directly from store to get current values (not stale hook values)
    const { misspelledWord, suggestions } = useSpellcheckStore.getState();

    if (!misspelledWord || capturedWord.toLowerCase() !== misspelledWord.toLowerCase()) {
      return null;
    }

    return buildSuggestionItems(suggestions);
  }, []);

  return {
    captureWordAtPoint,
    buildSpellMenuItems,
  };
}
