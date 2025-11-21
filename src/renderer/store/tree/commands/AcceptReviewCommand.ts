import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { buildAncestorRegistry } from '../../../utils/ancestry';
import { getAllDescendants, captureNodePosition } from '../../../utils/nodeHelpers';

/**
 * Snapshot of the original reviewing node and its descendants
 */
interface ReviewSnapshot {
  reviewingNodeId: string;
  reviewingNode: TreeNode;
  parentId: string;
  position: number;
  descendants: Map<string, TreeNode>;
  wasRootNode: boolean;
}

/**
 * Command for accepting a review and replacing nodes
 * Supports undo to restore the original nodes
 */
export class AcceptReviewCommand extends BaseCommand {
  private snapshot: ReviewSnapshot | null = null;

  constructor(
    private reviewingNodeId: string,
    private newRootNodeId: string,
    private newNodesMap: Record<string, TreeNode>,
    private getState: () => {
      nodes: Record<string, TreeNode>;
      rootNodeId: string;
      ancestorRegistry: Record<string, string[]>;
    },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      rootNodeId?: string;
      ancestorRegistry?: Record<string, string[]>;
      reviewingNodeId?: string | null;
      reviewFadingNodeIds?: Set<string>;
      activeNodeId?: string | null;
    }) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Accept review for node ${reviewingNodeId}`;
  }

  execute(): void {
    const state = this.getState();
    const reviewingNode = state.nodes[this.reviewingNodeId];

    if (!reviewingNode) {
      return;
    }

    // Capture position and descendants for undo
    const { parentId, originalPosition } = captureNodePosition(this.reviewingNodeId, state);
    const descendantIds = getAllDescendants(this.reviewingNodeId, state.nodes);
    const descendants = new Map<string, TreeNode>();
    for (const id of descendantIds) {
      descendants.set(id, { ...state.nodes[id] });
    }

    this.snapshot = {
      reviewingNodeId: this.reviewingNodeId,
      reviewingNode: { ...reviewingNode },
      parentId,
      position: originalPosition,
      descendants,
      wasRootNode: state.rootNodeId === this.reviewingNodeId,
    };

    // Build new nodes map: remove old, add new
    const mergedNodesMap = { ...state.nodes };
    delete mergedNodesMap[this.reviewingNodeId];
    for (const id of descendantIds) {
      delete mergedNodesMap[id];
    }
    Object.assign(mergedNodesMap, this.newNodesMap);

    // Update parent's children to point to new node
    const parent = mergedNodesMap[parentId];
    if (parent) {
      mergedNodesMap[parentId] = {
        ...parent,
        children: parent.children.map(id =>
          id === this.reviewingNodeId ? this.newRootNodeId : id
        ),
      };
    }

    const updatedRootNodeId = this.snapshot.wasRootNode ? this.newRootNodeId : state.rootNodeId;
    const newAncestorRegistry = buildAncestorRegistry(updatedRootNodeId, mergedNodesMap);

    // Collect new node IDs for fade effect
    const newNodeIds = [this.newRootNodeId, ...getAllDescendants(this.newRootNodeId, this.newNodesMap)];

    this.setState({
      nodes: mergedNodesMap,
      rootNodeId: updatedRootNodeId,
      ancestorRegistry: newAncestorRegistry,
      reviewingNodeId: null,
      reviewFadingNodeIds: new Set(newNodeIds),
      activeNodeId: this.newRootNodeId,
    });

    this.triggerAutosave?.();

    setTimeout(() => {
      this.setState({ reviewFadingNodeIds: new Set() });
    }, 1500);
  }

  undo(): void {
    if (!this.snapshot) return;

    const state = this.getState();
    const restoredNodesMap = { ...state.nodes };

    // Remove new nodes
    const newNodeIds = [this.newRootNodeId, ...getAllDescendants(this.newRootNodeId, this.newNodesMap)];
    for (const id of newNodeIds) {
      delete restoredNodesMap[id];
    }

    // Restore old nodes
    restoredNodesMap[this.snapshot.reviewingNodeId] = { ...this.snapshot.reviewingNode };
    this.snapshot.descendants.forEach((node, nodeId) => {
      restoredNodesMap[nodeId] = { ...node };
    });

    // Update parent's children to point back to original node
    const parent = restoredNodesMap[this.snapshot.parentId];
    if (parent) {
      restoredNodesMap[this.snapshot.parentId] = {
        ...parent,
        children: parent.children.map(id =>
          id === this.newRootNodeId ? this.snapshot!.reviewingNodeId : id
        ),
      };
    }

    const restoredRootNodeId = this.snapshot.wasRootNode
      ? this.snapshot.reviewingNodeId
      : state.rootNodeId;
    const newAncestorRegistry = buildAncestorRegistry(restoredRootNodeId, restoredNodesMap);

    this.setState({
      nodes: restoredNodesMap,
      rootNodeId: restoredRootNodeId,
      ancestorRegistry: newAncestorRegistry,
      reviewingNodeId: null,
      reviewFadingNodeIds: new Set(),
      activeNodeId: this.snapshot.reviewingNodeId,
    });

    this.triggerAutosave?.();
  }
}
