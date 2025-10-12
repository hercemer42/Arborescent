import { TreeNode, NodeTypeConfig } from '../../../shared/types';
import { loadFile as loadFileFromDisk, saveFile as saveFileToDisk } from '../../services/fileService';
import { defaultNodeTypeConfig } from '../../data/defaultTemplate';
import { buildAncestorRegistry, AncestorRegistry } from '../../services/registryService';

export interface FileActions {
  initialize: (nodes: Record<string, TreeNode>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  loadDocument: (nodes: Record<string, TreeNode>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  loadFromPath: (path: string) => Promise<{ created: string; author: string }>;
  saveToPath: (path: string, fileMeta?: { created: string; author: string }) => Promise<void>;
}

type StoreState = { nodes: Record<string, TreeNode>; rootNodeId: string; nodeTypeConfig: Record<string, NodeTypeConfig>; ancestorRegistry: AncestorRegistry };
type StoreSetter = (partial: Partial<StoreState>) => void;
type StoreGetter = () => StoreState;

export const createFileActions = (
  get: StoreGetter,
  set: StoreSetter
): FileActions => {
  const loadDoc = (nodes: Record<string, TreeNode>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => {
    const ancestorRegistry = buildAncestorRegistry(rootNodeId, nodes);
    set({ nodes, rootNodeId, nodeTypeConfig, ancestorRegistry });
  };

  return {
    initialize: loadDoc,
    loadDocument: loadDoc,

  loadFromPath: async (path: string) => {
    const data = await loadFileFromDisk(path);
    const configToUse = (data.nodeTypeConfig && Object.keys(data.nodeTypeConfig).length > 0)
      ? data.nodeTypeConfig
      : defaultNodeTypeConfig;

    const ancestorRegistry = buildAncestorRegistry(data.rootNodeId, data.nodes);

    set({
      nodes: data.nodes,
      rootNodeId: data.rootNodeId,
      nodeTypeConfig: configToUse,
      ancestorRegistry
    });

    return { created: data.created, author: data.author };
  },

    saveToPath: async (path: string, fileMeta?: { created: string; author: string }) => {
      const { nodes, rootNodeId, nodeTypeConfig } = get();
      await saveFileToDisk(path, nodes, rootNodeId, nodeTypeConfig, fileMeta);
    },
  };
};
