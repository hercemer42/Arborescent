import { create } from 'zustand';

interface SpellcheckState {
  misspelledWord: string | null;
  suggestions: string[];
  lastUpdate: number;
  setSuggestions: (word: string, suggestions: string[]) => void;
  clear: () => void;
}

export const useSpellcheckStore = create<SpellcheckState>((set) => ({
  misspelledWord: null,
  suggestions: [],
  lastUpdate: 0,

  setSuggestions: (word: string, suggestions: string[]) => {
    set({ misspelledWord: word, suggestions, lastUpdate: Date.now() });
  },

  clear: () => {
    set({ misspelledWord: null, suggestions: [], lastUpdate: Date.now() });
  },
}));

export function waitForSpellcheckUpdate(timeout = 500): Promise<void> {
  const startTime = Date.now();
  const initialUpdate = useSpellcheckStore.getState().lastUpdate;

  return new Promise((resolve) => {
    const check = () => {
      const currentUpdate = useSpellcheckStore.getState().lastUpdate;
      if (currentUpdate > initialUpdate || Date.now() - startTime > timeout) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}
