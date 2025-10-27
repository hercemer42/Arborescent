import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createNodeMovementActions, NodeMovementActions } from './actions/nodeMovementActions';
import { createNodeDeletionActions, NodeDeletionActions } from './actions/nodeDeletionActions';
import { StorageService } from '@platform';

export interface DeletedNodeEntry {
  rootNodeId: string;
  deletedAt: number;
  deleteBufferId: string;
}

export interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
  deletedNodes: DeletedNodeEntry[];

  actions: NodeActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions;
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

    return {
      nodes: {},
      rootNodeId: '',
      ancestorRegistry: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      deletedNodes: [],

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave),
        ...createNavigationActions(get, set),
        ...persistenceActions,
        ...createNodeMovementActions(get, set, persistenceActions.autoSave),
        ...createNodeDeletionActions(get, set, persistenceActions.autoSave),
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;
