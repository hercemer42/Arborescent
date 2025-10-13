import { TreeNode, NodeTypeConfig } from '../../../../shared/types';
import { StorageService } from '../../../../shared/interfaces';
import { defaultNodeTypeConfig } from '../../../data/defaultTemplate';
import { buildAncestorRegistry, AncestorRegistry } from '../../../utils/ancestry';
import { createArboFile } from '../../../utils/document';

export interface FileActions {
  initialize: (nodes: Record<string, TreeNode>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  loadDocument: (nodes: Record<string, TreeNode>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => void;
  loadFromPath: (path: string) => Promise<{ created: string; author: string }>;
  saveToPath: (path: string, fileMeta?: { created: string; author: string }) => Promise<void>;
  setFilePath: (path: string | null, meta?: { created: string; author: string } | null) => void;
  autoSave: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  ancestorRegistry: AncestorRegistry;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;
type StoreGetter = () => StoreState;

export const createFileActions = (
  get: StoreGetter,
  set: StoreSetter,
  storage: StorageService
): FileActions => {
  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;

  const loadDoc = (nodes: Record<string, TreeNode>, rootNodeId: string, nodeTypeConfig: Record<string, NodeTypeConfig>) => {
    const ancestorRegistry = buildAncestorRegistry(rootNodeId, nodes);
    set({ nodes, rootNodeId, nodeTypeConfig, ancestorRegistry });
  };

  const performSave = async (path: string, fileMeta?: { created: string; author: string }) => {
    const { nodes, rootNodeId, nodeTypeConfig } = get();
    const arboFile = createArboFile(nodes, rootNodeId, nodeTypeConfig, fileMeta);
    await storage.saveDocument(path, arboFile);
  };

  return {
    initialize: loadDoc,
    loadDocument: loadDoc,

    loadFromPath: async (path: string) => {
      const data = await storage.loadDocument(path);
      const configToUse = (data.nodeTypeConfig && Object.keys(data.nodeTypeConfig).length > 0)
        ? data.nodeTypeConfig
        : defaultNodeTypeConfig;

      const ancestorRegistry = buildAncestorRegistry(data.rootNodeId, data.nodes);

      set({
        nodes: data.nodes,
        rootNodeId: data.rootNodeId,
        nodeTypeConfig: configToUse,
        ancestorRegistry,
        currentFilePath: path,
        fileMeta: { created: data.created, author: data.author },
      });

      storage.saveLastSession(path);

      return { created: data.created, author: data.author };
    },

    saveToPath: async (path: string, fileMeta?: { created: string; author: string }) => {
      await performSave(path, fileMeta);
      set({ currentFilePath: path, fileMeta: fileMeta || null });
      storage.saveLastSession(path);
    },

    setFilePath: (path: string | null, meta?: { created: string; author: string } | null) => {
      set({ currentFilePath: path, fileMeta: meta || null });
    },

    autoSave: () => {
      if (autosaveTimeout) {
        clearTimeout(autosaveTimeout);
      }

      autosaveTimeout = setTimeout(async () => {
        const { currentFilePath, fileMeta } = get();
        if (currentFilePath) {
          try {
            await performSave(currentFilePath, fileMeta || undefined);
          } catch (error) {
            console.error('Autosave failed:', error);
          }
        }
        autosaveTimeout = null;
      }, 2000);
    },
  };
};
