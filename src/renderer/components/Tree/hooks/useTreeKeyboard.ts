import { useEffect } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { matchesHotkey } from '../../../data/hotkeyConfig';

export function useTreeKeyboard() {
  const moveUp = useStore((state) => state.actions.moveUp);
  const moveDown = useStore((state) => state.actions.moveDown);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesHotkey(event, 'navigation', 'moveUp')) {
        moveUp();
      } else if (matchesHotkey(event, 'navigation', 'moveDown')) {
        moveDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moveUp, moveDown]);
}
