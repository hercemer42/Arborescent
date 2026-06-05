import { createTreeStore, TreeStore, TreeStoreDeps } from './tree/treeStore';
import type { StoreAccess } from './storeAccess';
import { setFileActionsStoreAccess } from './files/filesStore';
import { feedbackTreeStore } from './feedback/feedbackTreeStore';
import { logger } from '../services/logger';
import { parseZoomPath } from '../utils/zoomPath';
import { useTabIndicatorStore, TabIndicatorState } from './tabIndicators/tabIndicatorStore';
import { useTerminalStore, setTerminalSessionResolver } from './terminal/terminalStore';
import { findSessionIdForTerminal } from '../utils/sessionTerminalLookup';
import { useBrowserStore } from './browser/browserStore';
import { usePanelStore } from './panel/panelStore';

function computeIndicators(state: { collaboratingNodeId: string | null; workflowExecutionStates: Record<string, { state: string }> }): TabIndicatorState {
  const execEntries = Object.values(state.workflowExecutionStates);
  const workflowRunning = execEntries.some(e => e.state === 'running');
  const awaitingValidation = execEntries.some(e => e.state === 'awaiting-validation');
  const feedbackPending = state.collaboratingNodeId !== null;
  const actionRequired = awaitingValidation || feedbackPending;

  return { feedbackPending, workflowRunning, actionRequired };
}

class StoreManager implements StoreAccess {
  private stores = new Map<string, TreeStore>();
  private subscriptions = new Map<string, () => void>();

  private treeStoreDeps(): TreeStoreDeps {
    return {
      getAllStores: () => this.getAllStores(),
      getStoreForFile: (filePath: string) => this.getStoreForFile(filePath),
    };
  }

  createFeedbackStore(): TreeStore {
    return createTreeStore('feedback', this.treeStoreDeps());
  }

  getStoreForFile(filePath: string): TreeStore {
    const zoomInfo = parseZoomPath(filePath);
    const actualPath = zoomInfo ? zoomInfo.sourceFilePath : filePath;

    if (!this.stores.has(actualPath)) {
      const store = createTreeStore('workspace', this.treeStoreDeps());
      this.stores.set(actualPath, store);
      this.subscribeToIndicators(actualPath, store);
    }
    return this.stores.get(actualPath)!;
  }

  getZoomInfo(filePath: string): { sourceFilePath: string; nodeId: string } | null {
    return parseZoomPath(filePath);
  }

  private subscribeToIndicators(filePath: string, store: TreeStore): void {
    let prevCollaboratingNodeId: string | null = null;
    let prevExecStates: Record<string, { state: string }> = {};

    const unsubscribe = store.subscribe((state) => {
      const collaboratingNodeId = state.collaboratingNodeId;
      const execStates = state.workflowExecutionStates;

      if (collaboratingNodeId !== prevCollaboratingNodeId || execStates !== prevExecStates) {
        prevCollaboratingNodeId = collaboratingNodeId;
        prevExecStates = execStates;

        const indicators = computeIndicators({ collaboratingNodeId, workflowExecutionStates: execStates });
        useTabIndicatorStore.getState().updateIndicator(filePath, indicators);
      }
    });

    this.subscriptions.set(filePath, unsubscribe);
  }

  async closeFile(filePath: string): Promise<void> {
    const store = this.stores.get(filePath);
    if (!store) return;

    await useTerminalStore.getState().closeFileTerminals(filePath);
    useBrowserStore.getState().actions.closeFileBrowserTabs(filePath);
    usePanelStore.getState().removeFileState(filePath);

    const { currentFilePath, fileMeta, actions } = store.getState();
    if (currentFilePath) {
      try {
        await actions.saveToPath(currentFilePath, fileMeta || undefined);
      } catch (error) {
        logger.error('Failed to save file before closing', error as Error, 'StoreManager');
      }
    }

    const unsubscribe = this.subscriptions.get(filePath);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(filePath);
    }

    useTabIndicatorStore.getState().removeIndicator(filePath);
    this.stores.delete(filePath);
  }

  moveStore(oldPath: string, newPath: string): void {
    const store = this.stores.get(oldPath);
    if (store) {
      this.stores.set(newPath, store);
      this.stores.delete(oldPath);
    }
  }

  hasStore(filePath: string): boolean {
    return this.stores.has(filePath);
  }

  getAllStores(): TreeStore[] {
    return Array.from(this.stores.values());
  }

  getAllStoreEntries(): Array<{ filePath: string; store: TreeStore }> {
    return Array.from(this.stores.entries()).map(([filePath, store]) => ({ filePath, store }));
  }

  clearAll(): void {
    this.stores.clear();
  }
}

export const storeManager = new StoreManager();

// Composition root: feed the two singletons that can't take constructor
// injection. These run on module load, so storeManager must stay eagerly
// imported on the renderer's startup path (App -> Workspace/useAppInitialization)
// — a future lazy-load would let a file/feedback action fire before wiring and
// trip the use-before-wired guards in filesStore/feedbackTreeStore.
setFileActionsStoreAccess(storeManager);
feedbackTreeStore.setStoreFactory(() => storeManager.createFeedbackStore());

// Let the terminal store persist each terminal's Claude sessionId at save time by
// reverse-looking-up the file's workflowSessionMap, without importing the tree
// store (which would close an import cycle).
setTerminalSessionResolver((filePath, terminalId) => {
  const sourcePath = storeManager.getZoomInfo(filePath)?.sourceFilePath ?? filePath;
  if (!storeManager.hasStore(sourcePath)) return undefined;
  return findSessionIdForTerminal(storeManager.getStoreForFile(sourcePath).getState().workflowSessionMap, terminalId);
});
