import { create } from 'zustand';
import { TreeNode, TreeType } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createNodeMovementActions, NodeMovementActions } from './actions/nodeMovementActions';
import { createNodeDeletionActions, NodeDeletionActions } from './actions/nodeDeletionActions';
import { createVisualEffectsActions, VisualEffectsActions } from './actions/visualEffectsActions';
import { createSelectionActions, SelectionActions } from './actions/selectionActions';
import { createHistoryActions, HistoryActions } from './actions/historyActions';
import { createCollaborateActions, CollaborateActions } from './actions/collaborateActions';
import { createClipboardActions, ClipboardActions } from './actions/clipboardActions';
import { HistoryManager } from './commands/HistoryManager';
import { StorageService } from '@platform';

export interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  treeType: TreeType;
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
  deletingNodeIds: Set<string>; // Nodes being animated out before deletion
  deleteAnimationCallback: (() => void) | null; // Callback to execute when delete animation completes
  collaboratingNodeId: string | null; // Node currently in collaboration
  feedbackFadingNodeIds: Set<string>; // Nodes fading out after feedback accepted

  actions: NodeActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions & VisualEffectsActions & SelectionActions & HistoryActions & CollaborateActions & ClipboardActions;
}

const storageService = new StorageService();

/**
 * We use a factory pattern instead of a singleton because each open file needs its own
 * independent tree state.
 * The storeManager handles store lifecycle, and TreeStoreContext allows switching
 * between file stores without prop drilling
 */
export function createTreeStore(treeType: TreeType = 'workspace') {
  return create<TreeState>((set, get) => {
    const historyManager = new HistoryManager();
    const persistenceActions = createPersistenceActions(get, set, storageService);
    const visualEffectsActions = createVisualEffectsActions(get, set);
    const navigationActions = createNavigationActions(get, set);
    const selectionActions = createSelectionActions(get, set);
    const historyActions = createHistoryActions(historyManager);
    const nodeDeletionActions = createNodeDeletionActions(get, set, persistenceActions.autoSave);
    const collaborateActions = createCollaborateActions(get, set, visualEffectsActions, persistenceActions.autoSave);

    // clipboardActions needs access to executeCommand and deleteNode, which are created above
    // We use a getter function to access them lazily after the store is created
    const clipboardActions = createClipboardActions(
      get,
      set,
      () => ({
        executeCommand: historyActions.executeCommand,
        deleteNode: nodeDeletionActions.deleteNode,
        autoSave: persistenceActions.autoSave,
      }),
      visualEffectsActions,
      persistenceActions.autoSave
    );

    return {
      nodes: {},
      rootNodeId: '',
      treeType,
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
      deletingNodeIds: new Set(),
      deleteAnimationCallback: null,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(),

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave),
        ...navigationActions,
        ...persistenceActions,
        ...createNodeMovementActions(get, set, persistenceActions.autoSave, visualEffectsActions, navigationActions),
        ...nodeDeletionActions,
        ...visualEffectsActions,
        ...selectionActions,
        ...historyActions,
        ...collaborateActions,
        ...clipboardActions,
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;
