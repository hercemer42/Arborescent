import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { removeNodeFromRegistry, addNodesToRegistry, buildAncestorRegistry, AncestorRegistry } from '../../../services/ancestry';
import { getAllDescendants, captureNodePosition } from '../../../utils/nodeHelpers';

/**
 * Snapshot of the original collaborating node and its descendants
 */
interface CollaborationSnapshot {
  collaboratingNodeId: string;
  collaboratingNode: TreeNode;
  parentId: string;
  position: number;
  descendants: Map<string, TreeNode>;
  wasRootNode: boolean;
}

/**
 * Command for accepting feedback and replacing nodes
 * Supports undo to restore the original nodes
 */
export class AcceptFeedbackCommand extends BaseCommand {
  private snapshot: CollaborationSnapshot | null = null;

  constructor(
    private collaboratingNodeId: string,
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
      collaboratingNodeId?: string | null;
      feedbackFadingNodeIds?: Set<string>;
      activeNodeId?: string | null;
    }) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Accept feedback for node ${collaboratingNodeId}`;
  }

  private captureSnapshot(
    collaboratingNode: TreeNode,
    state: ReturnType<typeof this.getState>
  ): CollaborationSnapshot {
    const { parentId, originalPosition } = captureNodePosition(this.collaboratingNodeId, state);
    const descendantIds = getAllDescendants(this.collaboratingNodeId, state.nodes);
    const descendants = new Map<string, TreeNode>();
    for (const id of descendantIds) {
      descendants.set(id, { ...state.nodes[id] });
    }

    return {
      collaboratingNodeId: this.collaboratingNodeId,
      collaboratingNode: { ...collaboratingNode },
      parentId,
      position: originalPosition,
      descendants,
      wasRootNode: state.rootNodeId === this.collaboratingNodeId,
    };
  }

  private buildMergedNodes(
    state: ReturnType<typeof this.getState>,
    collaboratingNode: TreeNode
  ): { mergedNodesMap: Record<string, TreeNode>; updatedNewNodesMap: Record<string, TreeNode> } {
    const mergedNodesMap = { ...state.nodes };

    // Remove old nodes
    delete mergedNodesMap[this.collaboratingNodeId];
    for (const id of this.snapshot!.descendants.keys()) {
      delete mergedNodesMap[id];
    }

    // Preserve context-related metadata from the original node
    const newRootNode = this.newNodesMap[this.newRootNodeId];
    const preservedMetadata: Record<string, unknown> = {};

    // Applied contexts
    if (collaboratingNode.metadata.appliedContextIds) {
      preservedMetadata.appliedContextIds = collaboratingNode.metadata.appliedContextIds;
    }
    if (collaboratingNode.metadata.activeContextId) {
      preservedMetadata.activeContextId = collaboratingNode.metadata.activeContextId;
    }

    // Context declaration
    if (collaboratingNode.metadata.isContextDeclaration) {
      preservedMetadata.isContextDeclaration = collaboratingNode.metadata.isContextDeclaration;
    }
    if (collaboratingNode.metadata.blueprintIcon) {
      preservedMetadata.blueprintIcon = collaboratingNode.metadata.blueprintIcon;
    }
    if (collaboratingNode.metadata.blueprintColor) {
      preservedMetadata.blueprintColor = collaboratingNode.metadata.blueprintColor;
    }
    if (collaboratingNode.metadata.bundledContextIds) {
      preservedMetadata.bundledContextIds = collaboratingNode.metadata.bundledContextIds;
    }

    const updatedNewNodesMap = {
      ...this.newNodesMap,
      [this.newRootNodeId]: {
        ...newRootNode,
        metadata: { ...newRootNode.metadata, ...preservedMetadata },
      },
    };

    Object.assign(mergedNodesMap, updatedNewNodesMap);

    // Update parent's children
    const parent = mergedNodesMap[this.snapshot!.parentId];
    if (parent) {
      mergedNodesMap[this.snapshot!.parentId] = {
        ...parent,
        children: parent.children.map(id =>
          id === this.collaboratingNodeId ? this.newRootNodeId : id
        ),
      };
    }

    return { mergedNodesMap, updatedNewNodesMap };
  }

  private buildAncestorRegistryForExecute(
    state: ReturnType<typeof this.getState>,
    mergedNodesMap: Record<string, TreeNode>,
    updatedRootNodeId: string
  ): AncestorRegistry {
    if (this.snapshot!.wasRootNode) {
      return buildAncestorRegistry(updatedRootNodeId, mergedNodesMap);
    }
    const registry = removeNodeFromRegistry(state.ancestorRegistry, this.collaboratingNodeId, state.nodes);
    return addNodesToRegistry(registry, [this.newRootNodeId], this.snapshot!.parentId, mergedNodesMap);
  }

  execute(): void {
    const state = this.getState();
    const collaboratingNode = state.nodes[this.collaboratingNodeId];
    if (!collaboratingNode) return;

    this.snapshot = this.captureSnapshot(collaboratingNode, state);
    const { mergedNodesMap, updatedNewNodesMap } = this.buildMergedNodes(state, collaboratingNode);
    const updatedRootNodeId = this.snapshot.wasRootNode ? this.newRootNodeId : state.rootNodeId;
    const newNodeIds = [this.newRootNodeId, ...getAllDescendants(this.newRootNodeId, updatedNewNodesMap)];
    const newAncestorRegistry = this.buildAncestorRegistryForExecute(state, mergedNodesMap, updatedRootNodeId);

    this.setState({
      nodes: mergedNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: updatedRootNodeId,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(newNodeIds),
      activeNodeId: this.newRootNodeId,
    });

    this.triggerAutosave?.();
    setTimeout(() => this.setState({ feedbackFadingNodeIds: new Set() }), 1500);
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
    restoredNodesMap[this.snapshot.collaboratingNodeId] = { ...this.snapshot.collaboratingNode };
    this.snapshot.descendants.forEach((node, nodeId) => {
      restoredNodesMap[nodeId] = { ...node };
    });

    // Update parent's children to point back to original node
    const parent = restoredNodesMap[this.snapshot.parentId];
    if (parent) {
      restoredNodesMap[this.snapshot.parentId] = {
        ...parent,
        children: parent.children.map(id =>
          id === this.newRootNodeId ? this.snapshot!.collaboratingNodeId : id
        ),
      };
    }

    const restoredRootNodeId = this.snapshot.wasRootNode
      ? this.snapshot.collaboratingNodeId
      : state.rootNodeId;

    // For ancestor registry: if restoring root, rebuild; otherwise incremental
    let newAncestorRegistry: AncestorRegistry;
    if (this.snapshot.wasRootNode) {
      // Root node changed, need full rebuild
      newAncestorRegistry = buildAncestorRegistry(restoredRootNodeId, restoredNodesMap);
    } else {
      // Incremental: remove new node subtree, add old node subtree back
      const registry = removeNodeFromRegistry(state.ancestorRegistry, this.newRootNodeId, this.newNodesMap);
      newAncestorRegistry = addNodesToRegistry(registry, [this.snapshot.collaboratingNodeId], this.snapshot.parentId, restoredNodesMap);
    }

    this.setState({
      nodes: restoredNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: restoredRootNodeId,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(),
      activeNodeId: this.snapshot.collaboratingNodeId,
    });

    this.triggerAutosave?.();
  }
}
