import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createNodeMovementActions, NodeMovementActions } from './actions/nodeMovementActions';
import { createNodeDeletionActions, NodeDeletionActions } from './actions/nodeDeletionActions';
import { createVisualEffectsActions, VisualEffectsActions } from './actions/visualEffectsActions';
import { StorageService } from '@platform';

export interface DeletedNodeEntry {
  rootNodeId: string;
  deletedAt: number;
  deleteBufferId: string;
}

export interface DeletedNodeInfo {
  node: TreeNode;
  originalParentId: string;
  originalPosition: number;
  deleteBufferId: string;
  deletedAt: number;
}

export interface TreeState {
  nodes: Record<string, TreeNode>;
  deletedNodesMap: Record<string, DeletedNodeInfo>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
  deletedNodes: DeletedNodeEntry[];
  flashingNodeId: string | null;

  actions: NodeActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions & VisualEffectsActions;
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
    const persistenceActions = createPersistenceActions(get, set, storageService);
    const visualEffectsActions = createVisualEffectsActions(get, set);
    const navigationActions = createNavigationActions(get, set);

    return {
      nodes: {},
      deletedNodesMap: {},
      rootNodeId: '',
      ancestorRegistry: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      deletedNodes: [],
      flashingNodeId: null,

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave),
        ...navigationActions,
        ...persistenceActions,
        ...createNodeMovementActions(get, set, persistenceActions.autoSave, visualEffectsActions, navigationActions),
        ...createNodeDeletionActions(get, set, persistenceActions.autoSave),
        ...visualEffectsActions,
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;
