import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { removeNodeFromRegistry, addNodesToRegistry } from '../../../utils/ancestry';
import { getParentId } from '../../../utils/nodeHelpers';
// eslint-disable-next-line import/no-cycle -- inert: useFilesStore.getState is read on command execute, never during module init. Story 2 (storeManager hub topology) removes this edge.
import { useFilesStore } from '../../files/filesStore';
import { StepHistoryEntry, StepHistoryMap } from '../stepHistory/stepHistory';

interface DeletedNodeSnapshot {
  node: TreeNode;
  parentId: string;
  position: number;
  preservedStepHistory: Record<string, StepHistoryEntry[]>;
}

export class DeleteNodeCommand extends BaseCommand {
  private snapshot: DeletedNodeSnapshot | null = null;
  private descendantSnapshots: Map<string, TreeNode> = new Map();

  constructor(
    private nodeId: string,
    private getState: () => {
      nodes: Record<string, TreeNode>;
      rootNodeId: string;
      ancestorRegistry: Record<string, string[]>;
      stepHistory?: StepHistoryMap;
    },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
      stepHistory?: StepHistoryMap;
    }) => void,
    private findPreviousNode: (
      nodeId: string,
      nodes: Record<string, TreeNode>,
      rootNodeId: string,
      ancestorRegistry: Record<string, string[]>
    ) => string | null,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Delete node ${nodeId}`;
    this.touchedNodeIds = new Set([nodeId]);
  }

  execute(): void {
    const { nodes, rootNodeId, ancestorRegistry, stepHistory } = this.getState();
    const node = nodes[this.nodeId];
    if (!node) return;

    const parentId = getParentId(this.nodeId, ancestorRegistry, rootNodeId);
    const parent = nodes[parentId];
    if (!parent) return;

    const position = parent.children.indexOf(this.nodeId);

    const preservedStepHistory: Record<string, StepHistoryEntry[]> = {};
    const collectStepHistory = (id: string) => {
      if (stepHistory?.[id]) {
        preservedStepHistory[id] = stepHistory[id];
      }
      const current = nodes[id];
      if (current) {
        for (const childId of current.children) collectStepHistory(childId);
      }
    };
    collectStepHistory(this.nodeId);

    this.snapshot = {
      node: { ...node },
      parentId,
      position,
      preservedStepHistory,
    };

    this.captureDescendants(this.nodeId, nodes);

    this.touchedNodeIds = new Set([this.nodeId, ...this.descendantSnapshots.keys()]);

    const nextNodeId = this.findPreviousNode(this.nodeId, nodes, rootNodeId, ancestorRegistry);

    const updatedNodes = { ...nodes };
    this.deleteRecursively(this.nodeId, updatedNodes);

    updatedNodes[parentId] = {
      ...parent,
      children: parent.children.filter(id => id !== this.nodeId),
    };

    const newAncestorRegistry = removeNodeFromRegistry(ancestorRegistry, this.nodeId, nodes);

    const selectedNode = updatedNodes[nextNodeId || parentId];
    const cursorPosition = selectedNode ? selectedNode.content.length : 0;

    let updatedStepHistory: StepHistoryMap | undefined;
    if (stepHistory && Object.keys(this.snapshot.preservedStepHistory).length > 0) {
      updatedStepHistory = { ...stepHistory };
      for (const id of Object.keys(this.snapshot.preservedStepHistory)) {
        delete updatedStepHistory[id];
      }
    }

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: nextNodeId || parentId,
      cursorPosition,
      ...(updatedStepHistory !== undefined ? { stepHistory: updatedStepHistory } : {}),
    });

    this.triggerAutosave?.();

    useFilesStore.getState().closeZoomTabsForNode(this.nodeId);
    this.descendantSnapshots.forEach((_, nodeId) => {
      useFilesStore.getState().closeZoomTabsForNode(nodeId);
    });
  }

  undo(): void {
    if (!this.snapshot) return;

    const { nodes, ancestorRegistry } = this.getState();
    const { parentId, position } = this.snapshot;
    const parent = nodes[parentId];
    if (!parent) return;

    const updatedNodes = { ...nodes };

    this.descendantSnapshots.forEach((node, nodeId) => {
      updatedNodes[nodeId] = { ...node };
    });

    updatedNodes[this.nodeId] = { ...this.snapshot.node };

    const updatedChildren = [...parent.children];
    updatedChildren.splice(position, 0, this.nodeId);

    updatedNodes[parentId] = {
      ...parent,
      children: updatedChildren,
    };

    const newAncestorRegistry = addNodesToRegistry(
      ancestorRegistry,
      [this.nodeId],
      parentId,
      updatedNodes
    );

    const cursorPosition = this.snapshot.node.content.length;

    const { stepHistory: currentStepHistory } = this.getState();
    let restoredStepHistory: StepHistoryMap | undefined;
    const preserved = this.snapshot.preservedStepHistory;
    if (Object.keys(preserved).length > 0) {
      restoredStepHistory = { ...(currentStepHistory ?? {}) };
      for (const [id, entries] of Object.entries(preserved)) {
        restoredStepHistory[id] = entries;
      }
    }

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.nodeId,
      cursorPosition,
      ...(restoredStepHistory !== undefined ? { stepHistory: restoredStepHistory } : {}),
    });

    this.triggerAutosave?.();
  }

  private captureDescendants(nodeId: string, nodes: Record<string, TreeNode>): void {
    const node = nodes[nodeId];
    if (!node) return;

    for (const childId of node.children) {
      const child = nodes[childId];
      if (child) {
        this.descendantSnapshots.set(childId, { ...child });
        this.captureDescendants(childId, nodes);
      }
    }
  }

  private deleteRecursively(nodeId: string, nodes: Record<string, TreeNode>): void {
    const node = nodes[nodeId];
    if (!node) return;

    for (const childId of node.children) {
      this.deleteRecursively(childId, nodes);
    }

    delete nodes[nodeId];
  }
}
