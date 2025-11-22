import { useFilesStore } from '../../store/files/filesStore';
import { matchesHotkey } from '../../data/hotkeyConfig';

/**
 * Keyboard UI service
 * Handles global UI shortcuts: files, tabs, terminal
 */

/**
 * Handles UI keyboard shortcuts
 */
async function handleUIShortcuts(event: KeyboardEvent): Promise<void> {
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

  // Toggle terminal
  if (matchesHotkey(event, 'view', 'toggleTerminal')) {
    event.preventDefault();
    const { usePanelStore } = await import('../../store/panel/panelStore');
    const { useTerminalStore } = await import('../../store/terminal/terminalStore');
    const panelStore = usePanelStore.getState();
    const terminalStore = useTerminalStore.getState();

    if (panelStore.activeContent === 'terminal') {
      panelStore.hidePanel();
    } else {
      // Create terminal if none exist
      if (terminalStore.terminals.length === 0) {
        const { createTerminal } = await import('../terminalService');
        await createTerminal('Terminal');
      }
      panelStore.showTerminal();
    }
    return;
  }

  // Toggle browser
  if (matchesHotkey(event, 'view', 'toggleBrowser')) {
    event.preventDefault();
    const { usePanelStore } = await import('../../store/panel/panelStore');
    const { useBrowserStore } = await import('../../store/browser/browserStore');
    const panelStore = usePanelStore.getState();
    const browserStore = useBrowserStore.getState();

    if (panelStore.activeContent === 'browser') {
      panelStore.hidePanel();
    } else {
      // Create browser tab if none exist
      if (browserStore.tabs.length === 0) {
        const { DEFAULT_BROWSER_URL } = await import('../../store/browser/browserStore');
        browserStore.actions.addTab(DEFAULT_BROWSER_URL);
      }
      panelStore.showBrowser();
    }
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
export function initializeUIService(target: HTMLElement | Window = window): () => void {
  target.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}
