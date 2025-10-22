import { useEffect } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { matchesHotkey } from '../../../data/hotkeyConfig';

export function useTabKeyboard() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const closeFile = useFilesStore((state) => state.actions.closeFile);

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (matchesHotkey(event, 'file', 'closeTab')) {
        event.preventDefault();
        if (activeFilePath) {
          await closeFile(activeFilePath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeFilePath, closeFile]);
}
