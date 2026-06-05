import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { TreeNode, TreeType, PendingProposalMap } from '../../../shared/types';
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
import { createPendingProposalActions, PendingProposalActions } from './actions/pendingProposalActions';
import { HistoryManager } from './commands/HistoryManager';
import { DisruptionActions } from './actions/workflowDisruption';
import { StepHistoryMap } from './stepHistory/stepHistory';
import { StorageService } from '../../services/storageService';
import { checkRegistryConsistency } from '../../utils/ancestry';

export type { WorkflowExecutionEntry };

export interface TreeStoreDeps {
  getAllStores: () => TreeStore[];
  getStoreForFile: (filePath: string) => TreeStore;
}

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
  pendingProposals?: PendingProposalMap;

  actions: NodeActions & ContextActions & BlueprintActions & NavigationActions & PersistenceActions & NodeMovementActions & NodeDeletionActions & VisualEffectsActions & SelectionActions & HistoryActions & SendActions & ClipboardActions & SummaryActions & WorkflowActions & WorkflowExecutionActions & SendToWorkflowActions & PendingProposalActions;
}

const storageService = new StorageService();

// On in dev (npm start) always; in a packaged build only when the renderer was
// built with ARBO_DIAGNOSTICS=1 (see vite.renderer.config.ts). Lets the
// production dogfood build run the registry-drift check without shipping the
// overhead to a normal build.
const DIAGNOSTICS_ON =
  process.env.ARBO_DIAGNOSTICS === '1' || process.env.NODE_ENV !== 'production';

export function createTreeStore(treeType: TreeType = 'workspace', deps?: TreeStoreDeps): TreeStore {
  const getAllStores = deps?.getAllStores ?? (() => []);
  const getStoreForFile = deps?.getStoreForFile;
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
    const historyActions = createHistoryActions(historyManager);
    const executeCommand = historyActions.executeCommand;

    // Late-binding refs for genuine forward references: the owners
    // (sendActions, workflowExecutionActions) are created further down because
    // they depend on actions constructed here first. Populated before the
    // store factory returns, same idiom as workflowExecutionRef below.
    const collaborationRestoreRef: { restoreCollaborationState?: () => Promise<void> } = {};
    const disruptionRef: DisruptionActions & { handleNodeMovedManually?: (nodeId: string) => void } = {};

    const persistenceActions = createPersistenceActions(
      get,
      set,
      storageService,
      async () => { await collaborationRestoreRef.restoreCollaborationState?.(); }
    );
    const visualEffectsActions = createVisualEffectsActions(get, set);
    const navigationActions = createNavigationActions(get, set, executeCommand);
    const selectionActions = createSelectionActions(get, set);

    const nodeDeletionActions = createNodeDeletionActions(get, set, persistenceActions.autoSave, executeCommand, disruptionRef);
    const sendActions = createSendActions(get, set, visualEffectsActions, persistenceActions.autoSave, executeCommand, getAllStores);
    collaborationRestoreRef.restoreCollaborationState = sendActions.restoreCollaborationState;

    const contextActions = createContextActions(get, set, persistenceActions.autoSave, executeCommand);
    const summaryActions = createSummaryActions(get, set, persistenceActions.autoSave);

    const clipboardActions = createClipboardActions(
      get,
      set,
      () => ({
        executeCommand,
        deleteNode: nodeDeletionActions.deleteNode,
        deleteNodes: nodeDeletionActions.deleteNodes,
        autoSave: persistenceActions.autoSave,
        handleNodeMovedManually: (nodeId: string) => disruptionRef.handleNodeMovedManually?.(nodeId),
      }),
      visualEffectsActions,
      persistenceActions.autoSave,
      getStoreForFile
    );

    const workflowExecutionRef: { continueWorkflow?: (nodeId: string, terminalId: string | null) => void } = {};
    const workflowActions = createWorkflowActions(
      get,
      set,
      persistenceActions.autoSave,
      executeCommand,
      visualEffectsActions,
      (nodeId, terminalId) => workflowExecutionRef.continueWorkflow?.(nodeId, terminalId),
    );
    const workflowExecutionActions = createWorkflowExecutionActions(
      get,
      set,
      persistenceActions.autoSave,
      visualEffectsActions,
      sendActions.autonomousCollaborateInTerminal,
      executeCommand,
      historyActions.invalidateUndoEntriesTouching,
    );
    workflowExecutionRef.continueWorkflow = workflowExecutionActions.continueWorkflow;
    disruptionRef.handleNodeDeleted = workflowExecutionActions.handleNodeDeleted;
    disruptionRef.handleStepDeleted = workflowExecutionActions.handleStepDeleted;
    disruptionRef.handleAllStepsRemoved = workflowExecutionActions.handleAllStepsRemoved;
    disruptionRef.handleNodeMovedManually = workflowExecutionActions.handleNodeMovedManually;

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
      pendingProposals: {},

      actions: {
        ...createNodeActions(get, set, persistenceActions.autoSave, {
          executeCommand,
          refreshContextDeclarations: contextActions.refreshContextDeclarations,
          refreshSummaryVisibleNodeIds: summaryActions.refreshSummaryVisibleNodeIds,
        }),
        ...contextActions,
        ...createBlueprintActions(get, set, persistenceActions.autoSave, executeCommand, contextActions.refreshContextDeclarations),
        ...navigationActions,
        ...persistenceActions,
        ...createNodeMovementActions(get, set, persistenceActions.autoSave, visualEffectsActions, navigationActions, {
          executeCommand,
          handleNodeMovedManually: (nodeId) => disruptionRef.handleNodeMovedManually?.(nodeId),
        }),
        ...nodeDeletionActions,
        ...visualEffectsActions,
        ...selectionActions,
        ...historyActions,
        ...sendActions,
        ...clipboardActions,
        ...summaryActions,
        ...workflowActions,
        ...workflowExecutionActions,
        ...createSendToWorkflowActions(get, set, persistenceActions.autoSave, visualEffectsActions, executeCommand),
        ...createPendingProposalActions(get, set, persistenceActions.autoSave, executeCommand),
      },
    };
  });
}

export type TreeStore = UseBoundStore<StoreApi<TreeState>>;
