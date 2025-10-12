import { create } from 'zustand';
import { TreeNode, NodeTypeConfig } from '../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createFileActions, FileActions } from './actions/fileActions';

interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  selectedNodeId: string | null;
  cursorPosition: number;
  rememberedCursorColumn: number | null;

  actions: NodeActions & NavigationActions & FileActions;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  nodes: {},
  rootNodeId: '',
  nodeTypeConfig: {},
  selectedNodeId: null,
  cursorPosition: 0,
  rememberedCursorColumn: null,

  actions: {
    ...createNodeActions(get, set),
    ...createNavigationActions(get, set),
    ...createFileActions(get, set),
  },
}));
