import { useFilesStore } from '../../store/files/filesStore';
import { useSearchStore } from '../../store/search/searchStore';
import { useToastStore } from '../../store/toast/toastStore';
import { matchesHotkey } from '../../data/hotkeyConfig';
import { hasTextSelection, isContentEditableFocused, isFocusInPanel } from '../../utils/selectionUtils';
import { getActiveStore } from './shared';
import { getActiveContextIdWithInheritance } from '../../utils/nodeHelpers';

async function handleUIShortcuts(event: KeyboardEvent): Promise<void> {
  if (matchesHotkey(event, 'actions', 'undo')) {
    if (isFocusInPanel()) return;
    event.preventDefault();
    event.stopPropagation();
    const store = getActiveStore();
    store?.getState().actions.undo();
    return;
  }

  if (matchesHotkey(event, 'actions', 'redo')) {
    if (isFocusInPanel()) return;
    event.preventDefault();
    event.stopPropagation();
    const store = getActiveStore();
    store?.getState().actions.redo();
    return;
  }

  if (matchesHotkey(event, 'file', 'save')) {
    event.preventDefault();
    useFilesStore.getState().actions.saveActiveFile();
    return;
  }

  if (matchesHotkey(event, 'file', 'saveAs')) {
    event.preventDefault();
    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (activeFilePath) {
      useFilesStore.getState().actions.saveFileAs(activeFilePath);
    }
    return;
  }

  if (matchesHotkey(event, 'file', 'open')) {
    event.preventDefault();
    useFilesStore.getState().actions.openFileWithDialog();
    return;
  }

  if (matchesHotkey(event, 'search', 'openSearch')) {
    event.preventDefault();
    useSearchStore.getState().openSearch();
    return;
  }

  if (matchesHotkey(event, 'file', 'closeTab')) {
    event.preventDefault();

    if (isFocusInPanel()) {
      const { usePanelStore } = await import('../../store/panel/panelStore');
      const panelStore = usePanelStore.getState();

      if (panelStore.activeContent === 'terminal') {
        const { useTerminalStore } = await import('../../store/terminal/terminalStore');
        const terminalStore = useTerminalStore.getState();
        if (terminalStore.activeTerminalId) {
          await terminalStore.closeTerminal(terminalStore.activeTerminalId);
        }
        return;
      }

      if (panelStore.activeContent === 'browser') {
        const { useBrowserStore } = await import('../../store/browser/browserStore');
        const browserStore = useBrowserStore.getState();
        if (browserStore.activeTabId) {
          browserStore.actions.closeTab(browserStore.activeTabId);
        }
        return;
      }

      return;
    }

    const activeFilePath = useFilesStore.getState().activeFilePath;
    if (activeFilePath) {
      useFilesStore.getState().closeFile(activeFilePath);
    }
    return;
  }

  if (matchesHotkey(event, 'view', 'toggleTerminal')) {
    event.preventDefault();
    const { usePanelStore } = await import('../../store/panel/panelStore');
    const { useTerminalStore } = await import('../../store/terminal/terminalStore');
    const panelStore = usePanelStore.getState();
    const terminalStore = useTerminalStore.getState();

    if (panelStore.activeContent === 'terminal') {
      panelStore.hidePanel();
    } else {
      if (terminalStore.terminals.length === 0) {
        await terminalStore.createNewTerminal('Terminal');
      }
      panelStore.showTerminal();
    }
    return;
  }

  if (matchesHotkey(event, 'view', 'toggleBrowser')) {
    event.preventDefault();
    const { usePanelStore } = await import('../../store/panel/panelStore');
    const { useBrowserStore } = await import('../../store/browser/browserStore');
    const panelStore = usePanelStore.getState();
    const browserStore = useBrowserStore.getState();

    if (panelStore.activeContent === 'browser') {
      panelStore.hidePanel();
    } else {
      if (browserStore.tabs.length === 0) {
        const { DEFAULT_BROWSER_URL } = await import('../../store/browser/browserStore');
        browserStore.actions.addTab(DEFAULT_BROWSER_URL);
      }
      panelStore.showBrowser();
    }
    return;
  }

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

  if (matchesHotkey(event, 'view', 'toggleBlueprintMode')) {
    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.toggleBlueprintMode();
    return;
  }

  if (matchesHotkey(event, 'view', 'toggleSummaryMode')) {
    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.toggleSummaryMode();
    return;
  }

  if (matchesHotkey(event, 'file', 'reload')) {
    event.preventDefault();
    window.location.reload();
    return;
  }

  if (matchesHotkey(event, 'actions', 'deleteNode')) {
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    if (state.multiSelectedNodeIds && state.multiSelectedNodeIds.size > 0) {
      event.preventDefault();
      state.actions.deleteSelectedNodes();
      return;
    }
    return;
  }

  if (matchesHotkey(event, 'actions', 'cut')) {
    if (hasTextSelection()) {
      return;
    }

    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.cutNodes();
    return;
  }

  if (matchesHotkey(event, 'actions', 'copy')) {
    if (hasTextSelection()) {
      return;
    }

    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.copyNodes();
    return;
  }

  if (matchesHotkey(event, 'actions', 'paste')) {
    event.preventDefault();
    const store = getActiveStore();
    if (store) {
      const result = await store.getState().actions.pasteNodes();

      // Insert plain text at cursor if no valid markdown nodes
      if (result === 'no-content' && isContentEditableFocused()) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            document.execCommand('insertText', false, text);
          }
        } catch {
          // Clipboard access denied or empty
        }
      }
    }
    return;
  }

  if (matchesHotkey(event, 'actions', 'selectAll')) {
    if (isContentEditableFocused()) {
      return;
    }
    event.preventDefault();
    const store = getActiveStore();
    store?.getState().actions.selectAllNodes();
    return;
  }

  if (matchesHotkey(event, 'editing', 'cancelEdit')) {
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    if (state.multiSelectedNodeIds && state.multiSelectedNodeIds.size > 0) {
      event.preventDefault();
      state.actions.clearSelection();
    }
    return;
  }

  if (matchesHotkey(event, 'actions', 'execute')) {
    event.preventDefault();
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    const activeNodeId = state.activeNodeId;
    if (!activeNodeId) return;

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

  if (matchesHotkey(event, 'actions', 'collaborate')) {
    event.preventDefault();
    const store = getActiveStore();
    if (!store) return;

    const state = store.getState();
    const activeNodeId = state.activeNodeId;
    if (!activeNodeId) return;

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

function handleKeyDown(event: KeyboardEvent): void {
  handleUIShortcuts(event);
}

export function initializeUIService(target: HTMLElement | Window = window): () => void {
  target.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}
