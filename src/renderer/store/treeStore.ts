import { create } from 'zustand';
import { TreeNode, NodeTypeConfig } from '../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createFileActions, FileActions } from './actions/fileActions';
import { createTreeStructureActions, TreeStructureActions } from './actions/treeStructureActions';
import { ElectronStorageService } from '@platform/storage';

interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  ancestorRegistry: Record<string, string[]>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;

  actions: NodeActions & NavigationActions & FileActions & TreeStructureActions;
}

const storageService = new ElectronStorageService();

export const useTreeStore = create<TreeState>((set, get) => {
  const fileActions = createFileActions(get, set, storageService);

  return {
    nodes: {},
    rootNodeId: '',
    nodeTypeConfig: {},
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
      ...createTreeStructureActions(get, set),
    },
  };
});
