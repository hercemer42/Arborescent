import { useEffect } from 'react';
import { useSpellcheckStore } from '../store/spellcheck/spellcheckStore';

export function useSpellcheckListener() {
  const setSuggestions = useSpellcheckStore((state) => state.setSuggestions);
  const clear = useSpellcheckStore((state) => state.clear);

  useEffect(() => {
    const cleanup = window.electron.onContextMenuParams((data) => {
      if (data.misspelledWord) {
        setSuggestions(data.misspelledWord, data.suggestions);
      } else {
        clear();
      }
    });

    return cleanup;
  }, [setSuggestions, clear]);
}
