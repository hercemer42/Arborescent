import { TreeNode, NodeStatus } from '../../../../shared/types';
import { updateNodeMetadata, getParentId } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../utils/ancestry';
import { v4 as uuidv4 } from 'uuid';
import { Command } from '../commands/Command';
import { ContentEditCommand } from '../commands/ContentEditCommand';
import { ToggleStatusCommand } from '../commands/ToggleStatusCommand';
import { SetStatusBatchCommand } from '../commands/SetStatusBatchCommand';
import { CreateNodeCommand } from '../commands/CreateNodeCommand';
import { SplitNodeCommand } from '../commands/SplitNodeCommand';
import { syncBoundTerminalTitles } from '../../terminal/syncBoundTerminalTitles';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  toggleStatus: (nodeId: string) => void;
  markAllAsComplete: (nodeId: string) => void;
  markAllAsIncomplete: (nodeId: string) => void;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  createNode: (currentNodeId: string) => void;
  createNodeBefore: (currentNodeId: string) => void;
  splitNode: (nodeId: string, content: string, cursorPosition: number, createAsChild?: boolean) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  blueprintModeEnabled: boolean;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

export interface NodeActionDeps {
  executeCommand: (command: Command) => void;
  refreshContextDeclarations?: () => void;
  refreshSummaryVisibleNodeIds?: () => void;
}

function generateId(): string {
  return uuidv4();
}

export const createNodeActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave: (() => void) | undefined,
  deps: NodeActionDeps
): NodeActions => {
  function selectNode(nodeId: string, cursorPosition?: number): void {
    set({
      activeNodeId: nodeId,
      cursorPosition: cursorPosition ?? 0,
    });
  }

  function updateContent(nodeId: string, content: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    if (node.metadata.isHyperlink === true || node.metadata.isExternalLink === true) {
      return;
    }

    const oldContent = node.content;

    const command = new ContentEditCommand(
      nodeId,
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      oldContent,
      content,
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      triggerAutosave,
      deps.refreshContextDeclarations
    );
    deps.executeCommand(command);
    syncBoundTerminalTitles(nodeId, get().nodes[nodeId]);
  }

  function updateStatus(nodeId: string, status: NodeStatus): void {
    const { nodes } = get();
    set({
      nodes: updateNodeMetadata(nodes, nodeId, { status }),
    });
    triggerAutosave?.();
  }

  function toggleStatus(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const command = new ToggleStatusCommand(
      nodeId,
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      triggerAutosave,
      () => deps.refreshSummaryVisibleNodeIds?.()
    );
    deps.executeCommand(command);
  }

  function markAllAsComplete(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const command = new SetStatusBatchCommand(
      nodeId,
      'completed',
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave,
      () => deps.refreshSummaryVisibleNodeIds?.()
    );
    deps.executeCommand(command);
  }

  function markAllAsIncomplete(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const command = new SetStatusBatchCommand(
      nodeId,
      'pending',
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave,
      () => deps.refreshSummaryVisibleNodeIds?.()
    );
    deps.executeCommand(command);
  }

  function setCursorPosition(position: number): void {
    set({ cursorPosition: position });
  }

  function setRememberedVisualX(visualX: number | null): void {
    set({ rememberedVisualX: visualX });
  }

  function createNode(currentNodeId: string): void {
    const { nodes, rootNodeId, ancestorRegistry, blueprintModeEnabled } = get();
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();
    const isExpanded = currentNode.metadata.expanded ?? true;
    const hasChildren = currentNode.children.length > 0;

    let parentId: string;
    let position: number;

    if (isExpanded && hasChildren) {
      parentId = currentNodeId;
      position = 0;
    } else {
      parentId = getParentId(currentNodeId, ancestorRegistry, rootNodeId);
      const parent = nodes[parentId];
      if (!parent) return;
      position = parent.children.indexOf(currentNodeId) + 1;
    }

    const initialMetadata = blueprintModeEnabled ? { isBlueprint: true } : undefined;

    const command = new CreateNodeCommand(
      newNodeId,
      parentId,
      position,
      '',
      () => {
        const currentState = get();
        return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId, ancestorRegistry: currentState.ancestorRegistry };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave,
      initialMetadata,
      currentNodeId
    );
    deps.executeCommand(command);
  }

  function createNodeBefore(currentNodeId: string): void {
    const { nodes, rootNodeId, ancestorRegistry, blueprintModeEnabled } = get();
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();

    const parentId = getParentId(currentNodeId, ancestorRegistry, rootNodeId);
    const parent = nodes[parentId];
    if (!parent) return;
    const position = parent.children.indexOf(currentNodeId);

    const initialMetadata = blueprintModeEnabled ? { isBlueprint: true } : undefined;

    const command = new CreateNodeCommand(
      newNodeId,
      parentId,
      position,
      '',
      () => {
        const currentState = get();
        return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId, ancestorRegistry: currentState.ancestorRegistry };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave,
      initialMetadata,
      currentNodeId
    );
    deps.executeCommand(command);
  }

  function splitNode(nodeId: string, content: string, cursorPosition: number, createAsChild: boolean = false): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    if (node.metadata.isHyperlink === true || node.metadata.isExternalLink === true) {
      return;
    }

    const contentBefore = content.slice(0, cursorPosition);
    const contentAfter = content.slice(cursorPosition);
    const newNodeId = generateId();

    const command = new SplitNodeCommand(
      nodeId,
      newNodeId,
      content,
      contentBefore,
      contentAfter,
      cursorPosition,
      () => {
        const currentState = get();
        return {
          nodes: currentState.nodes,
          rootNodeId: currentState.rootNodeId,
          ancestorRegistry: currentState.ancestorRegistry,
        };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave,
      createAsChild
    );
    deps.executeCommand(command);
  }

  return {
    selectNode,
    updateContent,
    updateStatus,
    toggleStatus,
    markAllAsComplete,
    markAllAsIncomplete,
    setCursorPosition,
    setRememberedVisualX,
    createNode,
    createNodeBefore,
    splitNode,
  };
};
