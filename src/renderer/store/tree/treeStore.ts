import { create } from 'zustand';
import { TreeNode, TreeType } from '../../../shared/types';
import { createNodeActions, NodeActions } from './actions/nodeActions';
import { createContextActions, ContextActions } from './actions/contextActions';
import { createBlueprintActions, BlueprintActions } from './actions/blueprintActions';
import { createNavigationActions, NavigationActions } from './actions/navigationActions';
import { createPersistenceActions, PersistenceActions } from './actions/persistenceActions';
import { createNodeMovementActions, NodeMovementActions } from './actions/nodeMovementActions';
import { createNodeDeletionActions, NodeDeletionActions } from './actions/nodeDeletionActions';
import { createVisualEffectsActions, VisualEffectsActions, FlashIntensity } from './actions/visualEffectsActions';
import { createSelectionActions, SelectionActions } from './actions/selectionActions';
import { createHistoryActions, HistoryActions } from './actions/historyActions';
import { createSendActions, SendActions } from './actions/sendActions';
import { createClipboardActions, ClipboardActions } from './actions/clipboardActions';
import { createSummaryActions, SummaryActions } from './actions/summaryActions';
import { createWorkflowActions, WorkflowActions } from './actions/workflowActions';
import { createWorkflowExecutionActions, WorkflowExecutionActions, WorkflowExecutionEntry } from './actions/workflowExecutionActions';
import { createSendToWorkflowActions, SendToWorkflowActions } from './actions/sendToWorkflowActions';
import { HistoryManager } from './commands/HistoryManager';
import { StepHistoryMap } from './stepHistory/stepHistory';
import { StorageService } from '../../services/storageService';
import { storeManager } from '../storeManager';
import { checkRegistryConsistency } from '../../utils/ancestry';

export type { WorkflowExecutionEntry };

export type ContextMode = 'collaborate' | 'execute';

export interface ContextDeclarationInfo {
  nodeId: string;
  content: string;
  icon: string;
  color?: string;
  collaborate: boolean;
  execute: boolean;
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
  flashingIntensity: FlashIntensity;
  scrollToNodeId: string | null;
  deletingNodeIds: Set<string>;
  deleteAnimationCallback: (() => void) | null;
  collaboratingNodeId: string | null;
  collaborationSource: 'browser' | 'terminal' | null;
  collaboratingTerminalId: string | null;
  decomposition: boolean;
  feedbackFadingNodeIds: Set<string>;
  contextDeclarations: ContextDeclarationInfo[];
  blueprintModeEnabled: boolean;
  isFileBlueprintFile: boolean;
  summaryModeEnabled: boolean;
  summaryDateFrom: string | null;
  summaryDateTo: string | null;
  summaryVisibleNodeIds: Set<string> | null;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
  stepHistory?: StepHistoryMap;

  actions: NodeActions & ContextActions & BlueprintActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions & VisualEffectsActions & SelectionActions & HistoryActions & SendActions & ClipboardActions & SummaryActions & WorkflowActions & WorkflowExecutionActions & SendToWorkflowActions;
}

const storageService = new StorageService();

// On in dev (npm start) always; in a packaged build only when the renderer was
// built with ARBO_DIAGNOSTICS=1 (see vite.renderer.config.ts). Lets the
// production dogfood build run the registry-drift check without shipping the
// overhead to a normal build.
const DIAGNOSTICS_ON =
  process.env.ARBO_DIAGNOSTICS === '1' || process.env.NODE_ENV !== 'production';

export function createTreeStore(treeType: TreeType = 'workspace') {
  return create<TreeState>((rawSet, get) => {
    // Drift guard: structural mutations set { nodes, ancestorRegistry } together;
    // content edits set only { nodes }. So checking object-form partials that
    // carry ancestorRegistry catches exactly the incremental structural updates
    // (the drift-prone paths) and never fires on typing. children is the source
    // of truth; we compare the claimed registry against a fresh rebuild from it.
    const set: typeof rawSet = (partial, replace?) => {
      if (
        DIAGNOSTICS_ON &&
        partial !== null &&
        typeof partial === 'object' &&
        'ancestorRegistry' in partial &&
        'nodes' in partial &&
        partial.nodes &&
        partial.ancestorRegistry
      ) {
        const rootNodeId = partial.rootNodeId ?? get().rootNodeId;
        checkRegistryConsistency(
          rootNodeId,
          partial.nodes as Record<string, TreeNode>,
          partial.ancestorRegistry as Record<string, string[]>,
          'store.set',
        );
      }
      return (rawSet as (p: typeof partial, r?: boolean) => void)(partial, replace);
    };

    const historyManager = new HistoryManager();
    const persistenceActions = createPersistenceActions(get, set, storageService);
    const visualEffectsActions = createVisualEffectsActions(get, set);
    const navigationActions = createNavigationActions(get, set);
    const selectionActions = createSelectionActions(get, set);
    const historyActions = createHistoryActions(historyManager);

    const nodeDeletionActions = createNodeDeletionActions(get, set, persistenceActions.autoSave);
    const sendActions = createSendActions(get, set, visualEffectsActions, persistenceActions.autoSave, () => storeManager.getAllStores());

    const contextActions = createContextActions(get, set, persistenceActions.autoSave, historyActions.executeCommand);

    const clipboardActions = createClipboardActions(
      get,
      set,
      () => ({
        executeCommand: historyActions.executeCommand,
        deleteNode: nodeDeletionActions.deleteNode,
        deleteNodes: nodeDeletionActions.deleteNodes,
        autoSave: persistenceActions.autoSave,
      }),
      visualEffectsActions,
      persistenceActions.autoSave
    );

    const workflowExecutionRef: { continueWorkflow?: (nodeId: string, terminalId: string | null) => void } = {};
    const workflowActions = createWorkflowActions(
      get,
      set,
      persistenceActions.autoSave,
      historyActions.executeCommand,
      visualEffectsActions,
      (nodeId, terminalId) => workflowExecutionRef.continueWorkflow?.(nodeId, terminalId),
    );
    const workflowExecutionActions = createWorkflowExecutionActions(
      get,
      set,
      persistenceActions.autoSave,
      visualEffectsActions,
      sendActions.autonomousCollaborateInTerminal,
      historyActions.executeCommand,
      historyActions.invalidateUndoEntriesTouching,
    );
    workflowExecutionRef.continueWorkflow = workflowExecutionActions.continueWorkflow;

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
      collaborationSource: null,
      collaboratingTerminalId: null,
      decomposition: false,
      feedbackFadingNodeIds: new Set(),
      contextDeclarations: [],
      blueprintModeEnabled: false,
      isFileBlueprintFile: false,
      summaryModeEnabled: false,
      summaryDateFrom: null,
      summaryDateTo: null,
      summaryVisibleNodeIds: null,
      workflowExecutionStates: {},
      workflowSessionMap: {},
      sessionRegistry: {},
      terminalNodeAssignments: {},
      stepHistory: {},

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
        ...sendActions,
        ...clipboardActions,
        ...createSummaryActions(get, set, persistenceActions.autoSave),
        ...workflowActions,
        ...workflowExecutionActions,
        ...createSendToWorkflowActions(get, set, persistenceActions.autoSave, visualEffectsActions, historyActions.executeCommand),
      },
    };
  });
}

export type TreeStore = ReturnType<typeof createTreeStore>;
