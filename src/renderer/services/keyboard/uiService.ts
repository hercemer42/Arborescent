import { useFilesStore } from '../../store/files/filesStore';
import { useTerminalStore } from '../../store/terminal/terminalStore';
import { storeManager } from '../../store/storeManager';
import { matchesHotkey } from '../../data/hotkeyConfig';

/**
 * Keyboard UI service
 * Handles global UI shortcuts: files, tabs, terminal
 */

/**
 * Handles UI keyboard shortcuts
 */
function handleUIShortcuts(event: KeyboardEvent): void {
  // Save file
  if (matchesHotkey(event, 'file', 'save')) {
    event.preventDefault();
    useFilesStore.getState().actions.saveActiveFile();
    return;
  }

  // Save file as
  if (matchesHotkey(event, 'file', 'saveAs')) {
    event.preventDefault();
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (activeFilePath) {
      useFilesStore.getState().actions.saveFileAs(activeFilePath);
    }
    return;
  }

  // Open file
  if (matchesHotkey(event, 'file', 'open')) {
    event.preventDefault();
    useFilesStore.getState().actions.openFileWithDialog();
    return;
  }

  // Close tab
  if (matchesHotkey(event, 'file', 'closeTab')) {
    event.preventDefault();
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (activeFilePath) {
      useFilesStore.getState().closeFile(activeFilePath);
    }
    return;
  }

  // Toggle terminal (Ctrl/Cmd + `)
  if (event.key === '`' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    useTerminalStore.getState().toggleTerminalVisibility();
    return;
  }
}

/**
 * Main keyboard event handler for UI shortcuts
 */
function handleKeyDown(event: KeyboardEvent): void {
  handleUIShortcuts(event);
}

/**
 * Initializes the UI keyboard service
 * Call this once when the app starts
 */
export function initializeUIService(): () => void {
  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}
