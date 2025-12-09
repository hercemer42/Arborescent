import { useFilesStore } from '../../store/files/filesStore';
import { useSearchStore } from '../../store/search/searchStore';
import { useToastStore } from '../../store/toast/toastStore';
import { matchesHotkey } from '../../data/hotkeyConfig';
import { hasTextSelection, isContentEditableFocused } from '../../utils/selectionUtils';
import { getActiveStore } from './shared';
import { getActiveContextIdWithInheritance } from '../../utils/nodeHelpers';

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

  // Open search
  if (matchesHotkey(event, 'search', 'openSearch')) {
    event.preventDefault();
    useSearchStore.getState().openSearch();
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
        await terminalStore.createNewTerminal('Terminal');
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

  // Toggle feedback/review panel
  if (matchesHotkey(event, 'view', 'toggleFeedback')) {
    event.preventDefault();
    const { usePanelStore } = await import('../../store/panel/panelStore');
    const panelStore = usePanelStore.getState();

    if (panelStore.activeContent === 'feedback') {
      panelStore.hidePanel();
    } else {
      panelStore.showFeedback();
    }
    return;
  }

  // Toggle blueprint mode
  if (matchesHotkey(event, 'view', 'toggleBlueprintMode')) {
    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.toggleBlueprintMode();
    return;
  }

  // Toggle summary mode
  if (matchesHotkey(event, 'view', 'toggleSummaryMode')) {
    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.toggleSummaryMode();
    return;
  }

  // Reload application
  if (matchesHotkey(event, 'file', 'reload')) {
    event.preventDefault();
    window.location.reload();
    return;
  }

  // Delete node(s) - handles multi-selection when no element is focused
  if (matchesHotkey(event, 'actions', 'deleteNode')) {
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    // Only handle here if there's a multi-selection (single node delete is handled by editingService)
    if (state.multiSelectedNodeIds && state.multiSelectedNodeIds.size > 0) {
      event.preventDefault();
      state.actions.deleteSelectedNodes();
      return;
    }
    // Let editingService handle single node delete
    return;
  }

  // Clipboard: Cut
  if (matchesHotkey(event, 'actions', 'cut')) {
    // If text is selected in contenteditable, let browser handle it
    if (hasTextSelection()) {
      return;
    }

    event.preventDefault();
    // Use getActiveStore to support both workspace and feedback panel
    const store = getActiveStore();
    store?.getState().actions.cutNodes();
    return;
  }

  // Clipboard: Copy
  if (matchesHotkey(event, 'actions', 'copy')) {
    // If text is selected in contenteditable, let browser handle it
    if (hasTextSelection()) {
      return;
    }

    event.preventDefault();
    // Use getActiveStore to support both workspace and feedback panel
    const store = getActiveStore();
    store?.getState().actions.copyNodes();
    return;
  }

  // Clipboard: Paste
  if (matchesHotkey(event, 'actions', 'paste')) {
    event.preventDefault();
    // Use getActiveStore to support both workspace and feedback panel
    const store = getActiveStore();
    if (store) {
      const result = await store.getState().actions.pasteNodes();

      // If no valid markdown nodes, insert plain text at cursor position
      // Use execCommand for proper undo/redo support
      if (result === 'no-content' && isContentEditableFocused()) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            // execCommand('insertText') integrates with browser undo stack
            document.execCommand('insertText', false, text);
          }
        } catch {
          // Clipboard access denied or empty - silently ignore
        }
      }
    }
    return;
  }

  // Select All
  if (matchesHotkey(event, 'actions', 'selectAll')) {
    // If in contenteditable, let browser handle text selection
    if (isContentEditableFocused()) {
      return;
    }
    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.selectAllNodes();
    return;
  }

  // Clear selection with Escape
  if (matchesHotkey(event, 'editing', 'cancelEdit')) {
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    if (state.multiSelectedNodeIds && state.multiSelectedNodeIds.size > 0) {
      event.preventDefault();
      state.actions.clearSelection();
    }
    // Let editingService handle blur/revert if a node is focused
    return;
  }

  // Execute in terminal (with active context)
  if (matchesHotkey(event, 'actions', 'execute')) {
    event.preventDefault();
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    const activeNodeId = state.activeNodeId;
    if (!activeNodeId) return;

    // Check if context is set
    const contextId = getActiveContextIdWithInheritance(
      activeNodeId,
      state.nodes,
      state.ancestorRegistry,
      'execute'
    );
    if (!contextId) {
      useToastStore.getState().addToast('No context set for this node', 'info');
      return;
    }

    state.actions.executeInTerminalWithContext(activeNodeId);
    return;
  }

  // Collaborate (with active context)
  if (matchesHotkey(event, 'actions', 'collaborate')) {
    event.preventDefault();
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    const activeNodeId = state.activeNodeId;
    if (!activeNodeId) return;

    // Check if context is set
    const contextId = getActiveContextIdWithInheritance(
      activeNodeId,
      state.nodes,
      state.ancestorRegistry,
      'collaborate'
    );
    if (!contextId) {
      useToastStore.getState().addToast('No context set for this node', 'info');
      return;
    }

    state.actions.collaborate(activeNodeId);
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
