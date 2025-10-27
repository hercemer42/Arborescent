import { useEffect } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { matchesHotkey } from '../../../data/hotkeyConfig';

export function useTreeKeyboard() {
  const undeleteNode = useStore((state) => state.actions.undeleteNode);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesHotkey(event, 'actions', 'undeleteNode')) {
        event.preventDefault();
        undeleteNode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undeleteNode]);
}
