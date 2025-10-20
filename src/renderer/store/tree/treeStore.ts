import { create } from 'zustand';
import { TreeNode } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createFileActions, FileActions } from './actions/fileActions';
import { createTreeStructureActions, TreeStructureActions } from './actions/treeStructureActions';
import { ElectronStorageService } from '@platform/storage';

export interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;

  actions: NodeActions & NavigationActions & FileActions & TreeStructureActions;
}

const storageService = new ElectronStorageService();

export function createTreeStore() {
  return create<TreeState>((set, get) => {
    const fileActions = createFileActions(get, set, storageService);

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
        ...createNodeActions(get, set, fileActions.autoSave),
        ...createNavigationActions(get, set),
        ...fileActions,
        ...createTreeStructureActions(get, set, fileActions.autoSave),
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;

// Default store for backward compatibility
export const useTreeStore = createTreeStore();
