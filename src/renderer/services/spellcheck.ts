import nspell from 'nspell';
// Import dictionary files as raw text
import affData from '../assets/dictionaries/en.aff?raw';
import dicData from '../assets/dictionaries/en.dic?raw';

let spell: ReturnType<typeof nspell> | null = null;

/**
 * Initialize the spellchecker with English dictionary
 */
export function initSpellcheck(): void {
  if (spell) return;
  spell = nspell({ aff: affData, dic: dicData });
}

/**
 * Check if a word is misspelled
 */
export function isMisspelled(word: string): boolean {
  if (!spell) return false;
  // Skip short words, numbers, and mixed case (likely code)
  if (word.length < 2) return false;
  if (/^\d+$/.test(word)) return false;
  if (/[A-Z].*[A-Z]/.test(word)) return false; // camelCase or ALLCAPS

  return !spell.correct(word);
}

/**
 * Get spelling suggestions for a word
 */
export function getSuggestions(word: string, limit: number = 5): string[] {
  if (!spell) return [];
  return spell.suggest(word).slice(0, limit);
}

/**
 * Check if word is misspelled (fast, no suggestions)
 */
export function checkWordFast(word: string): boolean {
  if (!spell) return false;
  return isMisspelled(word);
}

/**
 * Check spelling and get suggestions in one call
 */
export function checkWord(word: string): { misspelled: boolean; suggestions: string[] } | null {
  if (!spell) return null;

  const misspelled = isMisspelled(word);
  if (!misspelled) {
    return { misspelled: false, suggestions: [] };
  }

  return {
    misspelled: true,
    suggestions: getSuggestions(word),
  };
}
