import nspell from 'nspell';
import affData from '../assets/dictionaries/en.aff?raw';
import dicData from '../assets/dictionaries/en.dic?raw';

let spell: ReturnType<typeof nspell> | null = null;

export function initSpellcheck(): void {
  if (spell) return;
  spell = nspell({ aff: affData, dic: dicData });
}

export function isMisspelled(word: string): boolean {
  if (!spell) return false;
  if (word.length < 2) return false;
  if (/^\d+$/.test(word)) return false;
  // Skip camelCase or ALLCAPS (likely code)
  if (/[A-Z].*[A-Z]/.test(word)) return false;

  return !spell.correct(word);
}

export function getSuggestions(word: string, limit: number = 5): string[] {
  if (!spell) return [];
  return spell.suggest(word).slice(0, limit);
}

export function checkWordFast(word: string): boolean {
  if (!spell) return false;
  return isMisspelled(word);
}

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
