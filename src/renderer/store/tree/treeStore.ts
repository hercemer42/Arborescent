import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createNodeMovementActions, NodeMovementActions } from './actions/nodeMovementActions';
import { createNodeDeletionActions, NodeDeletionActions } from './actions/nodeDeletionActions';
import { createVisualEffectsActions, VisualEffectsActions } from './actions/visualEffectsActions';
import { createSelectionActions, SelectionActions } from './actions/selectionActions';
import { createHistoryActions, HistoryActions } from './actions/historyActions';
import { createReviewActions, ReviewActions } from './actions/reviewActions';
import { HistoryManager } from './commands/HistoryManager';
import { StorageService } from '@platform';

export interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null; // The single node being edited (cursor placement)
  multiSelectedNodeIds: Set<string>; // Nodes selected for bulk operations (drag, delete, etc.)
  lastSelectedNodeId: string | null; // For Shift+Click range selection anchor
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
  flashingNode: { nodeId: string; intensity: 'light' | 'medium' } | null;
  scrollToNodeId: string | null;
  reviewingNodeId: string | null; // Node currently being reviewed

  actions: NodeActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions & VisualEffectsActions & SelectionActions & HistoryActions & ReviewActions;
}

const storageService = new StorageService();

/**
 * We use a factory pattern instead of a singleton because each open file needs its own
 * independent tree state.
 * The storeManager handles store lifecycle, and TreeStoreContext allows switching
 * between file stores without prop drilling
 */
export function createTreeStore() {
  return create<TreeState>((set, get) => {
    const historyManager = new HistoryManager();
    const persistenceActions = createPersistenceActions(get, set, storageService);
    const visualEffectsActions = createVisualEffectsActions(get, set);
    const navigationActions = createNavigationActions(get, set);
    const selectionActions = createSelectionActions(get, set);
    const historyActions = createHistoryActions(historyManager);
    const reviewActions = createReviewActions(get, set);

    return {
      nodes: {},
      rootNodeId: '',
      ancestorRegistry: {},
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      flashingNode: null,
      scrollToNodeId: null,
      reviewingNodeId: null,

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave),
        ...navigationActions,
        ...persistenceActions,
        ...createNodeMovementActions(get, set, persistenceActions.autoSave, visualEffectsActions, navigationActions),
        ...createNodeDeletionActions(get, set, persistenceActions.autoSave),
        ...visualEffectsActions,
        ...selectionActions,
        ...historyActions,
        ...reviewActions,
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;
