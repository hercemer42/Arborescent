import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, buildAncestorRegistry, AncestorRegistry } from '../../../services/ancestry';
import { getAllDescendants, captureNodePosition } from '../../../utils/nodeHelpers';
import { DEFAULT_BLUEPRINT_ICON } from '../actions/blueprintActions';

interface CollaborationSnapshot {
  collaboratingNodeId: string;
  collaboratingNode: TreeNode;
  parentId: string;
  position: number;
  descendants: Map<string, TreeNode>;
  wasRootNode: boolean;
}

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
      blueprintModeEnabled: boolean;
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

  private getEffectiveBlueprintIcon(
    node: TreeNode,
    state: ReturnType<typeof this.getState>
  ): { icon: string; color?: string } {
    if (node.metadata.blueprintIcon) {
      return {
        icon: node.metadata.blueprintIcon as string,
        color: node.metadata.blueprintColor as string | undefined,
      };
    }

    const ancestors = state.ancestorRegistry[node.id] || [];
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = state.nodes[ancestors[i]];
      if (ancestor?.metadata.blueprintIcon) {
        return {
          icon: ancestor.metadata.blueprintIcon as string,
          color: ancestor.metadata.blueprintColor as string | undefined,
        };
      }
    }

    return { icon: DEFAULT_BLUEPRINT_ICON };
  }

  private applyBlueprintMetadataWithOriginalId(
    nodesMap: Record<string, TreeNode>,
    blueprintIcon: { icon: string; color?: string }
  ): Record<string, TreeNode> {
    const result: Record<string, TreeNode> = {};

    for (const [id, node] of Object.entries(nodesMap)) {
      const isRootNode = id === this.collaboratingNodeId;
      result[id] = {
        ...node,
        metadata: {
          ...node.metadata,
          isBlueprint: true,
          ...(isRootNode && { blueprintIcon: blueprintIcon.icon }),
          ...(isRootNode && blueprintIcon.color && { blueprintColor: blueprintIcon.color }),
        },
      };
    }

    return result;
  }

  private buildMergedNodes(
    state: ReturnType<typeof this.getState>,
    collaboratingNode: TreeNode
  ): { mergedNodesMap: Record<string, TreeNode>; updatedNewNodesMap: Record<string, TreeNode> } {
    const mergedNodesMap = { ...state.nodes };

    for (const id of this.snapshot!.descendants.keys()) {
      delete mergedNodesMap[id];
    }

    const preservedMetadata: Record<string, unknown> = {};

    if (collaboratingNode.metadata.appliedContextIds) {
      preservedMetadata.appliedContextIds = collaboratingNode.metadata.appliedContextIds;
    }
    if (collaboratingNode.metadata.activeContextId) {
      preservedMetadata.activeContextId = collaboratingNode.metadata.activeContextId;
    }
    if (collaboratingNode.metadata.appliedContextId) {
      preservedMetadata.appliedContextId = collaboratingNode.metadata.appliedContextId;
    }
    if (collaboratingNode.metadata.isContextDeclaration) {
      preservedMetadata.isContextDeclaration = collaboratingNode.metadata.isContextDeclaration;
    }
    if (collaboratingNode.metadata.blueprintIcon) {
      preservedMetadata.blueprintIcon = collaboratingNode.metadata.blueprintIcon;
    }
    if (collaboratingNode.metadata.blueprintColor) {
      preservedMetadata.blueprintColor = collaboratingNode.metadata.blueprintColor;
    }
    if (collaboratingNode.metadata.isBlueprint) {
      preservedMetadata.isBlueprint = collaboratingNode.metadata.isBlueprint;
    }

    let updatedNewNodesMap: Record<string, TreeNode> = {};

    for (const [id, node] of Object.entries(this.newNodesMap)) {
      if (id === this.newRootNodeId) {
        updatedNewNodesMap[this.collaboratingNodeId] = {
          ...node,
          id: this.collaboratingNodeId,
          metadata: { ...node.metadata, ...preservedMetadata },
        };
      } else {
        updatedNewNodesMap[id] = node;
      }
    }

    if (state.blueprintModeEnabled) {
      const effectiveIcon = this.getEffectiveBlueprintIcon(collaboratingNode, state);
      updatedNewNodesMap = this.applyBlueprintMetadataWithOriginalId(updatedNewNodesMap, effectiveIcon);
    }

    Object.assign(mergedNodesMap, updatedNewNodesMap);

    return { mergedNodesMap, updatedNewNodesMap };
  }

  private buildAncestorRegistryForExecute(
    state: ReturnType<typeof this.getState>,
    mergedNodesMap: Record<string, TreeNode>
  ): AncestorRegistry {
    if (this.snapshot!.wasRootNode) {
      return buildAncestorRegistry(this.collaboratingNodeId, mergedNodesMap);
    }
    const registry = { ...state.ancestorRegistry };
    for (const descendantId of this.snapshot!.descendants.keys()) {
      delete registry[descendantId];
    }
    const newDescendantIds = getAllDescendants(this.collaboratingNodeId, mergedNodesMap);
    return addNodesToRegistry(registry, newDescendantIds, this.collaboratingNodeId, mergedNodesMap);
  }

  execute(): void {
    const state = this.getState();
    const collaboratingNode = state.nodes[this.collaboratingNodeId];
    if (!collaboratingNode) return;

    this.snapshot = this.captureSnapshot(collaboratingNode, state);
    const { mergedNodesMap, updatedNewNodesMap } = this.buildMergedNodes(state, collaboratingNode);
    const newNodeIds = [this.collaboratingNodeId, ...getAllDescendants(this.collaboratingNodeId, updatedNewNodesMap)];
    const newAncestorRegistry = this.buildAncestorRegistryForExecute(state, mergedNodesMap);

    this.setState({
      nodes: mergedNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(newNodeIds),
      activeNodeId: this.collaboratingNodeId,
    });

    this.triggerAutosave?.();
    setTimeout(() => this.setState({ feedbackFadingNodeIds: new Set() }), 1500);
  }

  undo(): void {
    if (!this.snapshot) return;

    const state = this.getState();
    const restoredNodesMap = { ...state.nodes };
    const currentNode = restoredNodesMap[this.collaboratingNodeId];
    const newDescendantIds = currentNode ? getAllDescendants(this.collaboratingNodeId, restoredNodesMap) : [];

    for (const id of newDescendantIds) {
      delete restoredNodesMap[id];
    }

    restoredNodesMap[this.snapshot.collaboratingNodeId] = { ...this.snapshot.collaboratingNode };
    this.snapshot.descendants.forEach((node, nodeId) => {
      restoredNodesMap[nodeId] = { ...node };
    });

    let newAncestorRegistry: AncestorRegistry;
    if (this.snapshot.wasRootNode) {
      newAncestorRegistry = buildAncestorRegistry(this.snapshot.collaboratingNodeId, restoredNodesMap);
    } else {
      const registry = { ...state.ancestorRegistry };
      for (const id of newDescendantIds) {
        delete registry[id];
      }
      const originalDescendantIds = Array.from(this.snapshot.descendants.keys());
      newAncestorRegistry = addNodesToRegistry(registry, originalDescendantIds, this.collaboratingNodeId, restoredNodesMap);
    }

    this.setState({
      nodes: restoredNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(),
      activeNodeId: this.snapshot.collaboratingNodeId,
    });

    this.triggerAutosave?.();
  }
}
