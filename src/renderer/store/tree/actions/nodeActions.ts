import { TreeNode, NodeStatus } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../utils/ancestry';
import { v4 as uuidv4 } from 'uuid';
import { ContentEditCommand } from '../commands/ContentEditCommand';
import { ToggleStatusCommand } from '../commands/ToggleStatusCommand';
import { CreateNodeCommand } from '../commands/CreateNodeCommand';
import { logger } from '../../../services/logger';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  toggleStatus: (nodeId: string) => void;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  createNode: (currentNodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  reviewingNodeId: string | null;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

function generateId(): string {
  return uuidv4();
}

export const createNodeActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): NodeActions => {
  function selectNode(nodeId: string, cursorPosition?: number): void {
    set({
      activeNodeId: nodeId,
      cursorPosition: cursorPosition ?? 0,
    });
  }

  function updateContent(nodeId: string, content: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes, reviewingNodeId } = state;
    const node = nodes[nodeId];
    if (!node) return;

    // Prevent editing of node under review
    if (reviewingNodeId === nodeId) {
      logger.error('Cannot edit node under review', new Error('Node is being reviewed'), 'TreeStore');
      return;
    }

    const oldContent = node.content;

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot update content with undo/redo support');
    }

    const command = new ContentEditCommand(
      nodeId,
      () => (get() as StoreState).nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      oldContent,
      content,
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  function updateStatus(nodeId: string, status: NodeStatus): void {
    const { nodes } = get();
    set({
      nodes: updateNodeMetadata(nodes, nodeId, { status }),
    });
    triggerAutosave?.();
  }

  function toggleStatus(nodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes } = state;
    const node = nodes[nodeId];
    if (!node) return;

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot toggle status with undo/redo support');
    }

    const command = new ToggleStatusCommand(
      nodeId,
      () => (get() as StoreState).nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  function setCursorPosition(position: number): void {
    set({ cursorPosition: position });
  }

  function setRememberedVisualX(visualX: number | null): void {
    set({ rememberedVisualX: visualX });
  }

  function createNode(currentNodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes, rootNodeId, ancestorRegistry } = state;
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();
    const isExpanded = currentNode.metadata.expanded ?? true;
    const hasChildren = currentNode.children.length > 0;

    // Determine where to create the node
    let parentId: string;
    let position: number;

    if (isExpanded && hasChildren) {
      // Create as first child of current node
      parentId = currentNodeId;
      position = 0;
    } else {
      // Create as sibling after current node
      const ancestors = ancestorRegistry[currentNodeId] || [];
      parentId = ancestors[ancestors.length - 1] || rootNodeId;
      const parent = nodes[parentId];
      if (!parent) return;
      position = parent.children.indexOf(currentNodeId) + 1;
    }

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot create node with undo/redo support');
    }

    const command = new CreateNodeCommand(
      newNodeId,
      parentId,
      position,
      '',
      () => {
        const currentState = get() as StoreState;
        return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  return {
    selectNode,
    updateContent,
    updateStatus,
    toggleStatus,
    setCursorPosition,
    setRememberedVisualX,
    createNode,
  };
};
