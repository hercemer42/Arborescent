import { Node, NodeTypeConfig } from '../../../shared/types';
import { loadFile as loadFileFromDisk, saveFile as saveFileToDisk } from '../../services/fileService';
import { defaultNodeTypeConfig } from '../../data/defaultTemplate';

export interface FileActions {
  initialize: (nodes: Record<string, Node>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  loadDocument: (nodes: Record<string, Node>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  loadFromPath: (path: string) => Promise<{ created: string; author: string }>;
  saveToPath: (path: string, fileMeta?: { created: string; author: string }) => Promise<void>;
}

type StoreState = { nodes: Record<string, Node>; rootNodeId: string; nodeTypeConfig: Record<string, NodeTypeConfig> };
type StoreSetter = (partial: Partial<StoreState>) => void;
type StoreGetter = () => StoreState;

export const createFileActions = (
  get: StoreGetter,
  set: StoreSetter
): FileActions => {
  const loadDoc = (nodes: Record<string, Node>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => {
    set({ nodes, rootNodeId, nodeTypeConfig });
  };

  return {
    initialize: loadDoc,
    loadDocument: loadDoc,

  loadFromPath: async (path: string) => {
    const data = await loadFileFromDisk(path);
    const configToUse = (data.nodeTypeConfig && Object.keys(data.nodeTypeConfig).length > 0)
      ? data.nodeTypeConfig
      : defaultNodeTypeConfig;

    set({
      nodes: data.nodes,
      rootNodeId: data.rootNodeId,
      nodeTypeConfig: configToUse
    });

    return { created: data.created, author: data.author };
  },

    saveToPath: async (path: string, fileMeta?: { created: string; author: string }) => {
      const { nodes, rootNodeId, nodeTypeConfig } = get();
      await saveFileToDisk(path, nodes, rootNodeId, nodeTypeConfig, fileMeta);
    },
  };
};
