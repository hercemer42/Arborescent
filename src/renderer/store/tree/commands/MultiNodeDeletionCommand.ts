import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { removeNodeFromRegistry, addNodesToRegistry, AncestorRegistry } from '../../../services/ancestry';

/**
 * Captures a node and all its descendants for restoration
 */
interface DeletedNodeSnapshot {
  node: TreeNode;
  parentId: string;
  position: number;
}

type StateGetter = () => {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};

type StateSetter = (partial: {
  nodes?: Record<string, TreeNode>;
  ancestorRegistry?: AncestorRegistry;
  activeNodeId?: string;
  cursorPosition?: number;
  multiSelectedNodeIds?: Set<string>;
}) => void;

type FindPreviousNodeFn = (
  nodeId: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: AncestorRegistry
) => string | null;

/**
 * Base command for deleting multiple nodes at once (single undo operation).
 * Used by both cut and delete operations.
 */
export class MultiNodeDeletionCommand extends BaseCommand {
  private snapshots: Map<string, DeletedNodeSnapshot> = new Map();
  private allDescendants: Map<string, TreeNode> = new Map();

  constructor(
    private nodeIds: string[],
    private getState: StateGetter,
    private setState: StateSetter,
    private findPreviousNode: FindPreviousNodeFn,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Delete ${nodeIds.length} node(s)`;
  }

  execute(): void {
    const { nodes, rootNodeId, ancestorRegistry } = this.getState();

    this.captureSnapshots(nodes, rootNodeId, ancestorRegistry);

    const nextNodeId = this.findNextSelection(nodes, rootNodeId, ancestorRegistry);

    // Incremental update: remove each node and its descendants from registry
    let newAncestorRegistry = ancestorRegistry;
    for (const nodeId of this.nodeIds) {
      newAncestorRegistry = removeNodeFromRegistry(newAncestorRegistry, nodeId, nodes);
    }

    const updatedNodes = this.deleteNodes(nodes);

    this.updateState(updatedNodes, newAncestorRegistry, nextNodeId, rootNodeId);
    this.triggerAutosave?.();
  }

  undo(): void {
    const { nodes, rootNodeId, ancestorRegistry } = this.getState();

    const updatedNodes = this.restoreNodes(nodes);

    // Incremental update: add each restored node and its descendants back to registry
    // Group nodes by parent for efficient batch addition
    const nodesByParent = new Map<string, string[]>();
    for (const [nodeId, snapshot] of this.snapshots) {
      const existing = nodesByParent.get(snapshot.parentId) || [];
      existing.push(nodeId);
      nodesByParent.set(snapshot.parentId, existing);
    }

    let newAncestorRegistry = ancestorRegistry;
    for (const [parentId, nodeIds] of nodesByParent) {
      newAncestorRegistry = addNodesToRegistry(newAncestorRegistry, nodeIds, parentId, updatedNodes);
    }

    this.updateStateAfterRestore(updatedNodes, newAncestorRegistry);
    this.triggerAutosave?.();
  }

  /**
   * Get the IDs of nodes that were deleted
   */
  getDeletedNodeIds(): string[] {
    return this.nodeIds;
  }

  // --- Private helpers ---

  private captureSnapshots(
    nodes: Record<string, TreeNode>,
    rootNodeId: string,
    ancestorRegistry: AncestorRegistry
  ): void {
    for (const nodeId of this.nodeIds) {
      const node = nodes[nodeId];
      if (!node) continue;

      const ancestors = ancestorRegistry[nodeId] || [];
      const parentId = ancestors[ancestors.length - 1] || rootNodeId;
      const parent = nodes[parentId];
      if (!parent) continue;

      const position = parent.children.indexOf(nodeId);

      this.snapshots.set(nodeId, {
        node: { ...node },
        parentId,
        position,
      });

      this.captureDescendants(nodeId, nodes);
    }
  }

  private captureDescendants(nodeId: string, nodes: Record<string, TreeNode>): void {
    const node = nodes[nodeId];
    if (!node) return;

    for (const childId of node.children) {
      const child = nodes[childId];
      if (child) {
        this.allDescendants.set(childId, { ...child });
        this.captureDescendants(childId, nodes);
      }
    }
  }

  private findNextSelection(
    nodes: Record<string, TreeNode>,
    rootNodeId: string,
    ancestorRegistry: AncestorRegistry
  ): string | null {
    const firstNodeId = this.nodeIds[0];
    return this.findPreviousNode(firstNodeId, nodes, rootNodeId, ancestorRegistry);
  }

  private deleteNodes(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
    const updatedNodes = { ...nodes };

    for (const nodeId of this.nodeIds) {
      const snapshot = this.snapshots.get(nodeId);
      if (!snapshot) continue;

      this.deleteRecursively(nodeId, updatedNodes);

      const parent = updatedNodes[snapshot.parentId];
      if (parent) {
        updatedNodes[snapshot.parentId] = {
          ...parent,
          children: parent.children.filter((id) => id !== nodeId),
        };
      }
    }

    return updatedNodes;
  }

  private deleteRecursively(nodeId: string, nodes: Record<string, TreeNode>): void {
    const node = nodes[nodeId];
    if (!node) return;

    for (const childId of node.children) {
      this.deleteRecursively(childId, nodes);
    }

    delete nodes[nodeId];
  }

  private updateState(
    nodes: Record<string, TreeNode>,
    ancestorRegistry: AncestorRegistry,
    nextNodeId: string | null,
    rootNodeId: string
  ): void {
    const selectedNodeId = nextNodeId || rootNodeId;
    const selectedNode = nodes[selectedNodeId];
    const cursorPosition = selectedNode ? selectedNode.content.length : 0;

    this.setState({
      nodes,
      ancestorRegistry,
      activeNodeId: selectedNodeId,
      cursorPosition,
      multiSelectedNodeIds: new Set(),
    });
  }

  private restoreNodes(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
    const updatedNodes = { ...nodes };

    // Restore all descendants first
    this.allDescendants.forEach((node, nodeId) => {
      updatedNodes[nodeId] = { ...node };
    });

    // Restore nodes in reverse order to maintain correct sibling positions
    const sortedSnapshots = Array.from(this.snapshots.entries()).sort(
      ([, a], [, b]) => b.position - a.position
    );

    for (const [nodeId, snapshot] of sortedSnapshots) {
      updatedNodes[nodeId] = { ...snapshot.node };

      const parent = updatedNodes[snapshot.parentId];
      if (parent) {
        // Filter out the node ID first to avoid duplicates, then insert at correct position
        const updatedChildren = parent.children.filter((id) => id !== nodeId);
        updatedChildren.splice(snapshot.position, 0, nodeId);

        updatedNodes[snapshot.parentId] = {
          ...parent,
          children: updatedChildren,
        };
      }
    }

    return updatedNodes;
  }

  private updateStateAfterRestore(
    nodes: Record<string, TreeNode>,
    ancestorRegistry: AncestorRegistry
  ): void {
    const firstNodeId = this.nodeIds[0];
    const firstSnapshot = this.snapshots.get(firstNodeId);
    const cursorPosition = firstSnapshot ? firstSnapshot.node.content.length : 0;

    this.setState({
      nodes,
      ancestorRegistry,
      activeNodeId: firstNodeId,
      cursorPosition,
    });
  }
}
