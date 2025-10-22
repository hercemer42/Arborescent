import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createTreeStructureActions, TreeStructureActions } from './actions/treeStructureActions';
import { StorageService } from '@platform';

export interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;

  actions: NodeActions & NavigationActions & PersistenceActions & TreeStructureActions;
}

const storageService = new StorageService();

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

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave),
        ...createNavigationActions(get, set),
        ...persistenceActions,
        ...createTreeStructureActions(get, set, persistenceActions.autoSave),
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;

// Default store for backward compatibility
export const useTreeStore = createTreeStore();
