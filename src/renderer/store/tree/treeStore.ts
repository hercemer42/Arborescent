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

export function createTreeStore(treeType: TreeType = 'workspace') {
  return create<TreeState>((set, get) => {
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
