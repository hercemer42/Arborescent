import Typo from 'typo-js';
// Import dictionary files as raw text
import affData from 'typo-js/dictionaries/en_US/en_US.aff?raw';
import dicData from 'typo-js/dictionaries/en_US/en_US.dic?raw';

let dictionary: Typo | null = null;

/**
 * Initialize the spellchecker with en_US dictionary
 */
export function initSpellcheck(): void {
  if (dictionary) return;
  dictionary = new Typo('en_US', affData, dicData);
}

/**
 * Check if a word is misspelled
 */
export function isMisspelled(word: string): boolean {
  if (!dictionary) return false;
  // Skip short words, numbers, and mixed case (likely code)
  if (word.length < 2) return false;
  if (/^\d+$/.test(word)) return false;
  if (/[A-Z].*[A-Z]/.test(word)) return false; // camelCase or ALLCAPS

  return !dictionary.check(word);
}

/**
 * Get spelling suggestions for a word
 */
export function getSuggestions(word: string, limit: number = 5): string[] {
  if (!dictionary) return [];
  return dictionary.suggest(word).slice(0, limit);
}

/**
 * Check spelling and get suggestions in one call
 */
export function checkWord(word: string): { misspelled: boolean; suggestions: string[] } | null {
  if (!dictionary) return null;

  const misspelled = isMisspelled(word);
  if (!misspelled) {
    return { misspelled: false, suggestions: [] };
  }

  return {
    misspelled: true,
    suggestions: getSuggestions(word),
  };
}
