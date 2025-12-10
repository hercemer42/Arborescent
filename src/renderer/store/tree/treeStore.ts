import { create } from 'zustand';
import { TreeNode, TreeType } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createContextActions, ContextActions } from './actions/contextActions';
import { createBlueprintActions, BlueprintActions } from './actions/blueprintActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createNodeMovementActions, NodeMovementActions } from './actions/nodeMovementActions';
import { createNodeDeletionActions, NodeDeletionActions } from './actions/nodeDeletionActions';
import { createVisualEffectsActions, VisualEffectsActions } from './actions/visualEffectsActions';
import { createSelectionActions, SelectionActions } from './actions/selectionActions';
import { createHistoryActions, HistoryActions } from './actions/historyActions';
import { createCollaborateActions, CollaborateActions } from './actions/collaborateActions';
import { createClipboardActions, ClipboardActions } from './actions/clipboardActions';
import { createExecuteActions, ExecuteActions } from './actions/executeActions';
import { createSummaryActions, SummaryActions } from './actions/summaryActions';
import { HistoryManager } from './commands/HistoryManager';
import { StorageService } from '@platform';

export interface ContextDeclarationInfo {
  nodeId: string;
  content: string;
  icon: string;
  color?: string;
}

export interface TreeState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  treeType: TreeType;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null;
  multiSelectedNodeIds: Set<string>;
  lastSelectedNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  currentFilePath: string | null;
  fileMeta: { created: string; author: string } | null;
  flashingNodeIds: Set<string>;
  flashingIntensity: 'light' | 'medium';
  scrollToNodeId: string | null;
  deletingNodeIds: Set<string>;
  deleteAnimationCallback: (() => void) | null;
  collaboratingNodeId: string | null;
  feedbackFadingNodeIds: Set<string>;
  contextDeclarations: ContextDeclarationInfo[];
  blueprintModeEnabled: boolean;
  isFileBlueprintFile: boolean;
  summaryModeEnabled: boolean;
  summaryDateFrom: string | null;
  summaryDateTo: string | null;
  summaryVisibleNodeIds: Set<string> | null;

  actions: NodeActions & ContextActions & BlueprintActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions & VisualEffectsActions & SelectionActions & HistoryActions & CollaborateActions & ClipboardActions & ExecuteActions & SummaryActions;
}

const storageService = new StorageService();

export function createTreeStore(treeType: TreeType = 'workspace') {
  return create<TreeState>((set, get) => {
    const historyManager = new HistoryManager();
    const persistenceActions = createPersistenceActions(get, set, storageService);
    const visualEffectsActions = createVisualEffectsActions(get, set);
    const navigationActions = createNavigationActions(get, set);
    const selectionActions = createSelectionActions(get, set);
    const historyActions = createHistoryActions(historyManager);

    const nodeDeletionActions = createNodeDeletionActions(get, set, persistenceActions.autoSave);
    const collaborateActions = createCollaborateActions(get, set, visualEffectsActions, persistenceActions.autoSave);
    const executeActions = createExecuteActions(get);

    const contextActions = createContextActions(get, set, persistenceActions.autoSave);

    const clipboardActions = createClipboardActions(
      get,
      set,
      () => ({
        executeCommand: historyActions.executeCommand,
        deleteNode: nodeDeletionActions.deleteNode,
        autoSave: persistenceActions.autoSave,
      }),
      visualEffectsActions,
      persistenceActions.autoSave
    );

    return {
      nodes: {},
      rootNodeId: '',
      treeType,
      ancestorRegistry: {},
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      flashingNodeIds: new Set(),
      flashingIntensity: 'light',
      scrollToNodeId: null,
      deletingNodeIds: new Set(),
      deleteAnimationCallback: null,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(),
      contextDeclarations: [],
      blueprintModeEnabled: false,
      isFileBlueprintFile: false,
      summaryModeEnabled: false,
      summaryDateFrom: null,
      summaryDateTo: null,
      summaryVisibleNodeIds: null,

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave),
        ...contextActions,
        ...createBlueprintActions(get, set, persistenceActions.autoSave, historyActions.executeCommand, contextActions.refreshContextDeclarations),
        ...navigationActions,
        ...persistenceActions,
        ...createNodeMovementActions(get, set, persistenceActions.autoSave, visualEffectsActions, navigationActions),
        ...nodeDeletionActions,
        ...visualEffectsActions,
        ...selectionActions,
        ...historyActions,
        ...collaborateActions,
        ...clipboardActions,
        ...executeActions,
        ...createSummaryActions(get, set, persistenceActions.autoSave),
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;
