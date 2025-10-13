import { useEffect } from 'react';
import { useStore } from '../../../store/tree/useStore';

export function useTreeKeyboard() {
  const moveUp = useStore((state) => state.actions.moveUp);
  const moveDown = useStore((state) => state.actions.moveDown);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        moveUp();
      } else if (event.key === 'ArrowDown' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        moveDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moveUp, moveDown]);
}
