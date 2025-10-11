import { create } from 'zustand';
import { Node, NodeTypeConfig } from '../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createFileActions, FileActions } from './actions/fileActions';

interface TreeState {
  nodes: Record<string, Node>;
  rootNodeId: string;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  selectedNodeId: string | null;
  editingNodeId: string | null;

  actions: NodeActions & NavigationActions & FileActions;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  nodes: {},
  rootNodeId: '',
  nodeTypeConfig: {},
  selectedNodeId: null,
  editingNodeId: null,

  actions: {
    ...createNodeActions(get, set),
    ...createNavigationActions(get, set),
    ...createFileActions(get, set),
  },
}));
