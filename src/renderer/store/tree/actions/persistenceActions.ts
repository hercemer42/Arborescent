import { TreeNode } from '../../../../shared/types';
import { StorageService } from '../../../../shared/interfaces';
import { buildAncestorRegistry, AncestorRegistry } from '../../../utils/ancestry';
import { createArboFile } from '../../../utils/document';

export interface PersistenceActions {
  initialize: (nodes: Record<string, TreeNode>, rootNodeId: string) => void;
  loadDocument: (nodes: Record<string, TreeNode>, rootNodeId: string) => void;
  loadFromPath: (path: string) => Promise<{ created: string; author: string }>;
  saveToPath: (path: string, fileMeta?: { created: string; author: string }) => Promise<void>;
  setFilePath: (path: string | null, meta?: { created: string; author: string } | null) => void;
  autoSave: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;
type StoreGetter = () => StoreState;

export const createPersistenceActions = (
  get: StoreGetter,
  set: StoreSetter,
  storage: StorageService
): PersistenceActions => {
  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;

  function loadDoc(nodes: Record<string, TreeNode>, rootNodeId: string): void {
    const ancestorRegistry = buildAncestorRegistry(rootNodeId, nodes);
    set({ nodes, rootNodeId, ancestorRegistry });
  }

  async function performSave(path: string, fileMeta?: { created: string; author: string }): Promise<void> {
    const { nodes, rootNodeId } = get();
    const arboFile = createArboFile(nodes, rootNodeId, fileMeta);
    await storage.saveDocument(path, arboFile);
  }

  async function loadFromPath(path: string): Promise<{ created: string; author: string }> {
    const data = await storage.loadDocument(path);

    const ancestorRegistry = buildAncestorRegistry(data.rootNodeId, data.nodes);

    set({
      nodes: data.nodes,
      rootNodeId: data.rootNodeId,
      ancestorRegistry,
      currentFilePath: path,
      fileMeta: { created: data.created, author: data.author },
    });

    return { created: data.created, author: data.author };
  }

  async function saveToPath(path: string, fileMeta?: { created: string; author: string }): Promise<void> {
    await performSave(path, fileMeta);
    set({ currentFilePath: path, fileMeta: fileMeta || null });
  }

  function setFilePath(path: string | null, meta?: { created: string; author: string } | null): void {
    set({ currentFilePath: path, fileMeta: meta || null });
  }

  function autoSave(): void {
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
  }

  return {
    initialize: loadDoc,
    loadDocument: loadDoc,
    loadFromPath,
    saveToPath,
    setFilePath,
    autoSave,
  };
};
