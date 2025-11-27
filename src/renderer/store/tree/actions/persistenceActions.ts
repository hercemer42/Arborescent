import { TreeNode, NodeStatus } from '../../../../shared/types';
import { StorageService } from '../../../../shared/interfaces';
import { updateAncestorRegistry, AncestorRegistry } from '../../../services/ancestry';
import { createArboFile } from '../../../utils/document';
import { getContextDeclarations } from '../../../utils/nodeHelpers';
import { ContextDeclarationInfo } from '../treeStore';

const STATUS_MIGRATION_MAP: Record<string, NodeStatus> = {
  '☐': 'pending',
  '✓': 'completed',
  '✗': 'failed',
};

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
  contextDeclarations: ContextDeclarationInfo[];
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
    set({ ...updateAncestorRegistry(rootNodeId, nodes), rootNodeId });
  }

  async function performSave(path: string, fileMeta?: { created: string; author: string }): Promise<void> {
    const { nodes, rootNodeId } = get();
    const arboFile = createArboFile(nodes, rootNodeId, fileMeta);
    await storage.saveDocument(path, arboFile);
  }

  async function loadFromPath(path: string): Promise<{ created: string; author: string }> {
    const data = await storage.loadDocument(path);

    // Migrate old status symbols to new enum values
    const migratedNodes = { ...data.nodes };
    Object.keys(migratedNodes).forEach(nodeId => {
      const node = migratedNodes[nodeId];
      if (node.metadata.status && typeof node.metadata.status === 'string') {
        const oldStatus = node.metadata.status as string;
        if (oldStatus in STATUS_MIGRATION_MAP) {
          migratedNodes[nodeId] = {
            ...node,
            metadata: {
              ...node.metadata,
              status: STATUS_MIGRATION_MAP[oldStatus],
            },
          };
        }
      }
    });

    // Ensure root node has isRoot metadata (migration for older files)
    const rootNode = migratedNodes[data.rootNodeId];
    if (rootNode && !rootNode.metadata.isRoot) {
      migratedNodes[data.rootNodeId] = {
        ...rootNode,
        metadata: { ...rootNode.metadata, isRoot: true },
      };
    }

    const contextDeclarations = getContextDeclarations(migratedNodes);

    set({
      ...updateAncestorRegistry(data.rootNodeId, migratedNodes),
      rootNodeId: data.rootNodeId,
      currentFilePath: path,
      fileMeta: { created: data.created, author: data.author },
      contextDeclarations,
    });

    // Restore collaboration state if there's collaboration metadata
    const state = get() as StoreState & { actions?: { restoreCollaborationState?: () => Promise<void> } };
    if (state.actions?.restoreCollaborationState) {
      await state.actions.restoreCollaborationState();
    }

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
