import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { removeNodeFromRegistry, addNodesToRegistry } from '../../../services/ancestry';
import { useFilesStore } from '../../files/filesStore';

interface DeletedNodeSnapshot {
  node: TreeNode;
  parentId: string;
  position: number;
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
    },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
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
  }

  execute(): void {
    const { nodes, rootNodeId, ancestorRegistry } = this.getState();
    const node = nodes[this.nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[this.nodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return;

    const position = parent.children.indexOf(this.nodeId);

    this.snapshot = {
      node: { ...node },
      parentId,
      position,
    };

    this.captureDescendants(this.nodeId, nodes);

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

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: nextNodeId || parentId,
      cursorPosition,
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

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.nodeId,
      cursorPosition,
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
