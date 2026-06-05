import { TreeNode, NodeStatus, PendingProposalMap } from '../../../../shared/types';
import { logger } from '../../../services/logger';
import { StorageService } from '../../../../shared/interfaces';
import { updateAncestorRegistry, AncestorRegistry } from '../../../utils/ancestry';
import { createArboFile } from '../../../utils/document';
import { getContextDeclarations } from '../../../utils/nodeHelpers';
import type { ContextDeclarationInfo } from '../treeStore';

const STATUS_MIGRATION_MAP: Record<string, NodeStatus> = {
  '☐': 'pending',
  '✓': 'completed',
  '✗': 'abandoned',
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
  activeNodeId: string | null;
  ancestorRegistry: AncestorRegistry;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
  contextDeclarations: ContextDeclarationInfo[];
  blueprintModeEnabled: boolean;
  isFileBlueprintFile: boolean;
  summaryDateFrom: string | null;
  summaryDateTo: string | null;
  sessionRegistry: Record<string, { cwd: string }>;
  pendingProposals?: PendingProposalMap;
};
type StoreSetter = (partial: Partial<StoreState>) => void;
type StoreGetter = () => StoreState;

export const createPersistenceActions = (
  get: StoreGetter,
  set: StoreSetter,
  storage: StorageService,
  restoreCollaborationState?: () => Promise<void>
): PersistenceActions => {
  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;

  function loadDoc(nodes: Record<string, TreeNode>, rootNodeId: string): void {
    set({ ...updateAncestorRegistry(rootNodeId, nodes), rootNodeId, sessionRegistry: {}, pendingProposals: {} });
  }

  async function performSave(path: string, fileMeta?: { created: string; author: string }): Promise<void> {
    const { nodes, rootNodeId, isFileBlueprintFile, summaryDateFrom, summaryDateTo, sessionRegistry, pendingProposals } = get();
    const arboFile = createArboFile(nodes, rootNodeId, fileMeta, isFileBlueprintFile, summaryDateFrom, summaryDateTo, sessionRegistry, pendingProposals);
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

    Object.keys(migratedNodes).forEach(nodeId => {
      const node = migratedNodes[nodeId];
      let needsUpdate = false;
      const updatedMetadata = { ...node.metadata };

      if (
        node.metadata.isContextDeclaration === true &&
        node.metadata.collaborate === undefined &&
        node.metadata.execute === undefined
      ) {
        updatedMetadata.collaborate = true;
        updatedMetadata.execute = false;
        needsUpdate = true;
      }

      if (node.metadata.appliedContextIds !== undefined) {
        delete updatedMetadata.appliedContextIds;
        needsUpdate = true;
      }

      if (needsUpdate) {
        migratedNodes[nodeId] = {
          ...node,
          metadata: updatedMetadata,
        };
      }
    });

    const contextDeclarations = getContextDeclarations(migratedNodes);
    const isBlueprint = data.isBlueprint === true;

    const loadedRoot = migratedNodes[data.rootNodeId];
    const initialActiveNodeId = loadedRoot?.children?.[0] ?? data.rootNodeId;

    set({
      ...updateAncestorRegistry(data.rootNodeId, migratedNodes),
      rootNodeId: data.rootNodeId,
      activeNodeId: initialActiveNodeId,
      currentFilePath: path,
      fileMeta: { created: data.created, author: data.author },
      contextDeclarations,
      isFileBlueprintFile: isBlueprint,
      blueprintModeEnabled: isBlueprint,
      summaryDateFrom: null,
      summaryDateTo: null,
      sessionRegistry: data.sessionRegistry ?? {},
      pendingProposals: data.pendingProposals ?? {},
    });

    // Restore collaboration state if there's collaboration metadata
    await restoreCollaborationState?.();

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
          logger.error('Autosave failed', error as Error, 'Persistence');
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
