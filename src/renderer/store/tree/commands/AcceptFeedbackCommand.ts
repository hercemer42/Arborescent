import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, buildAncestorRegistry, AncestorRegistry } from '../../../utils/ancestry';
import { getAllDescendants, captureNodePosition } from '../../../utils/nodeHelpers';
import { DEFAULT_BLUEPRINT_ICON } from '../actions/blueprintActions';
import { v4 as uuidv4 } from 'uuid';

interface CollaborationSnapshot {
  collaboratingNodeId: string;
  collaboratingNode: TreeNode;
  parentId: string;
  position: number;
  descendants: Map<string, TreeNode>;
  wasRootNode: boolean;
  parentChildren: string[];
}

export class AcceptFeedbackCommand extends BaseCommand {
  private snapshot: CollaborationSnapshot | null = null;
  private createdNodeIds: string[] = [];
  private cachedIdMap: Record<string, string> | null = null;
  private isMultiRoot: boolean;
  private newRootNodeIds: string[];

  constructor(
    private collaboratingNodeId: string,
    newRootNodeIdOrIds: string | string[],
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
    this.newRootNodeIds = Array.isArray(newRootNodeIdOrIds) ? newRootNodeIdOrIds : [newRootNodeIdOrIds];
    this.isMultiRoot = this.newRootNodeIds.length > 1;
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

    const parent = state.nodes[parentId];

    return {
      collaboratingNodeId: this.collaboratingNodeId,
      collaboratingNode: { ...collaboratingNode },
      parentId,
      position: originalPosition,
      descendants,
      wasRootNode: state.rootNodeId === this.collaboratingNodeId,
      parentChildren: parent ? [...parent.children] : [],
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

  private getIdMap(preserveRootId: boolean): Record<string, string> {
    if (this.cachedIdMap) return this.cachedIdMap;

    const idMap: Record<string, string> = {};
    if (preserveRootId) {
      idMap[this.newRootNodeIds[0]] = this.collaboratingNodeId;
    }
    for (const id of Object.keys(this.newNodesMap)) {
      if (!idMap[id]) {
        idMap[id] = uuidv4();
      }
    }
    this.cachedIdMap = idMap;
    return idMap;
  }

  private getPreservedMetadata(collaboratingNode: TreeNode): Record<string, unknown> {
    const preserved: Record<string, unknown> = {};
    const keys = [
      'appliedContextIds', 'activeContextId', 'appliedContextId',
      'isContextDeclaration', 'blueprintIcon', 'blueprintColor', 'isBlueprint',
      'expanded',
    ];
    for (const key of keys) {
      if (collaboratingNode.metadata[key] !== undefined) {
        preserved[key] = collaboratingNode.metadata[key];
      }
    }
    return preserved;
  }

  private applyBlueprintMetadata(
    nodesMap: Record<string, TreeNode>,
    rootNodeIds: string[],
    blueprintIcon: { icon: string; color?: string }
  ): Record<string, TreeNode> {
    const rootIdSet = new Set(rootNodeIds);
    const result: Record<string, TreeNode> = {};

    for (const [id, node] of Object.entries(nodesMap)) {
      const isRoot = rootIdSet.has(id);
      result[id] = {
        ...node,
        metadata: {
          ...node.metadata,
          isBlueprint: true,
          ...(isRoot && { blueprintIcon: blueprintIcon.icon }),
          ...(isRoot && blueprintIcon.color && { blueprintColor: blueprintIcon.color }),
        },
      };
    }

    return result;
  }

  private executeSingleRoot(state: ReturnType<typeof this.getState>, collaboratingNode: TreeNode): void {
    const preservedMetadata = this.getPreservedMetadata(collaboratingNode);
    const newRootNodeId = this.newRootNodeIds[0];
    const idMap = this.getIdMap(true);

    let updatedNewNodesMap: Record<string, TreeNode> = {};
    for (const [id, node] of Object.entries(this.newNodesMap)) {
      const newId = idMap[id];
      const remappedChildren = node.children.map((childId) => idMap[childId] || childId);

      if (id === newRootNodeId) {
        updatedNewNodesMap[newId] = {
          ...node,
          id: newId,
          children: remappedChildren,
          metadata: { ...node.metadata, ...preservedMetadata },
        };
      } else {
        updatedNewNodesMap[newId] = {
          ...node,
          id: newId,
          children: remappedChildren,
        };
      }
    }

    if (state.blueprintModeEnabled || collaboratingNode.metadata.isBlueprint) {
      const effectiveIcon = this.getEffectiveBlueprintIcon(collaboratingNode, state);
      updatedNewNodesMap = this.applyBlueprintMetadata(updatedNewNodesMap, [this.collaboratingNodeId], effectiveIcon);
    }

    const mergedNodesMap = { ...state.nodes };
    for (const id of this.snapshot!.descendants.keys()) {
      delete mergedNodesMap[id];
    }
    Object.assign(mergedNodesMap, updatedNewNodesMap);

    this.createdNodeIds = [this.collaboratingNodeId, ...getAllDescendants(this.collaboratingNodeId, updatedNewNodesMap)];

    let newAncestorRegistry: AncestorRegistry;
    if (this.snapshot!.wasRootNode) {
      newAncestorRegistry = buildAncestorRegistry(this.collaboratingNodeId, mergedNodesMap);
    } else {
      const registry = { ...state.ancestorRegistry };
      for (const descendantId of this.snapshot!.descendants.keys()) {
        delete registry[descendantId];
      }
      const newDescendantIds = getAllDescendants(this.collaboratingNodeId, mergedNodesMap);
      newAncestorRegistry = addNodesToRegistry(registry, newDescendantIds, this.collaboratingNodeId, mergedNodesMap);
    }

    this.setState({
      nodes: mergedNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(this.createdNodeIds),
      activeNodeId: this.collaboratingNodeId,
    });
  }

  private executeMultiRoot(state: ReturnType<typeof this.getState>, collaboratingNode: TreeNode): void {
    if (this.snapshot!.wasRootNode) {
      this.executeSingleRoot(state, collaboratingNode);
      return;
    }

    const preservedMetadata = this.getPreservedMetadata(collaboratingNode);
    const idMap = this.getIdMap(false);

    let updatedNewNodesMap: Record<string, TreeNode> = {};
    const newRootIdSet = new Set(this.newRootNodeIds);

    for (const [id, node] of Object.entries(this.newNodesMap)) {
      const newId = idMap[id];
      const remappedChildren = node.children.map((childId) => idMap[childId] || childId);
      const isRoot = newRootIdSet.has(id);

      updatedNewNodesMap[newId] = {
        ...node,
        id: newId,
        children: remappedChildren,
        ...(isRoot && { metadata: { ...node.metadata, ...preservedMetadata } }),
        ...(!isRoot && { metadata: { ...node.metadata } }),
      };
    }

    if (state.blueprintModeEnabled || collaboratingNode.metadata.isBlueprint) {
      const effectiveIcon = this.getEffectiveBlueprintIcon(collaboratingNode, state);
      const mappedRootIds = this.newRootNodeIds.map(id => idMap[id]);
      updatedNewNodesMap = this.applyBlueprintMetadata(updatedNewNodesMap, mappedRootIds, effectiveIcon);
    }

    const mergedNodesMap = { ...state.nodes };

    delete mergedNodesMap[this.collaboratingNodeId];
    for (const id of this.snapshot!.descendants.keys()) {
      delete mergedNodesMap[id];
    }

    Object.assign(mergedNodesMap, updatedNewNodesMap);

    const mappedRootIds = this.newRootNodeIds.map(id => idMap[id]);
    const parentNode = mergedNodesMap[this.snapshot!.parentId];
    if (parentNode) {
      const newChildren = [...parentNode.children];
      const collabIndex = newChildren.indexOf(this.collaboratingNodeId);
      if (collabIndex >= 0) {
        newChildren.splice(collabIndex, 1, ...mappedRootIds);
      } else {
        newChildren.push(...mappedRootIds);
      }
      mergedNodesMap[this.snapshot!.parentId] = {
        ...parentNode,
        children: newChildren,
      };
    }

    this.createdNodeIds = [];
    for (const rootId of mappedRootIds) {
      this.createdNodeIds.push(rootId, ...getAllDescendants(rootId, updatedNewNodesMap));
    }

    const registry = { ...state.ancestorRegistry };
    delete registry[this.collaboratingNodeId];
    for (const descendantId of this.snapshot!.descendants.keys()) {
      delete registry[descendantId];
    }
    let newAncestorRegistry = registry;
    for (const rootId of mappedRootIds) {
      const descendants = getAllDescendants(rootId, mergedNodesMap);
      newAncestorRegistry = addNodesToRegistry(newAncestorRegistry, [rootId, ...descendants], this.snapshot!.parentId, mergedNodesMap);
    }

    this.setState({
      nodes: mergedNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(this.createdNodeIds),
      activeNodeId: mappedRootIds[0],
    });
  }

  execute(): void {
    const state = this.getState();
    const collaboratingNode = state.nodes[this.collaboratingNodeId];
    if (!collaboratingNode) return;

    if (!this.snapshot) {
      this.snapshot = this.captureSnapshot(collaboratingNode, state);
    }

    if (this.isMultiRoot) {
      this.executeMultiRoot(state, collaboratingNode);
    } else {
      this.executeSingleRoot(state, collaboratingNode);
    }

    this.triggerAutosave?.();
    setTimeout(() => this.setState({ feedbackFadingNodeIds: new Set() }), 1500);
  }

  undo(): void {
    if (!this.snapshot) return;

    const state = this.getState();
    const restoredNodesMap = { ...state.nodes };

    for (const id of this.createdNodeIds) {
      delete restoredNodesMap[id];
    }

    restoredNodesMap[this.snapshot.collaboratingNodeId] = { ...this.snapshot.collaboratingNode };
    this.snapshot.descendants.forEach((node, nodeId) => {
      restoredNodesMap[nodeId] = { ...node };
    });

    if (this.isMultiRoot && !this.snapshot.wasRootNode) {
      const parentNode = restoredNodesMap[this.snapshot.parentId];
      if (parentNode) {
        restoredNodesMap[this.snapshot.parentId] = {
          ...parentNode,
          children: [...this.snapshot.parentChildren],
        };
      }
    }

    let newAncestorRegistry: AncestorRegistry;
    if (this.snapshot.wasRootNode) {
      newAncestorRegistry = buildAncestorRegistry(this.snapshot.collaboratingNodeId, restoredNodesMap);
    } else {
      const registry = { ...state.ancestorRegistry };
      for (const id of this.createdNodeIds) {
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
