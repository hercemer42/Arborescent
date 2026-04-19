import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, buildAncestorRegistry, AncestorRegistry } from '../../../utils/ancestry';
import { getAllDescendants, captureNodePosition } from '../../../utils/nodeHelpers';
import { getEffectiveBlueprintIcon } from '../../../utils/blueprintInheritance';
import { v4 as uuidv4 } from 'uuid';

export interface ArchiveConfig {
  archiveDestinationId: string;
  archiveSideLinkName: string;
  replacementSideLinkName: string;
}

interface CollaborationSnapshot {
  collaboratingNodeId: string;
  collaboratingNode: TreeNode;
  parentId: string;
  position: number;
  descendants: Map<string, TreeNode>;
  wasRootNode: boolean;
  parentChildren: string[];
  archiveDestinationChildren?: string[];
}

export class AcceptFeedbackCommand extends BaseCommand {
  private snapshot: CollaborationSnapshot | null = null;
  private createdNodeIds: string[] = [];
  private relationLinkNodeIds: string[] = [];
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
      collaborationSource?: 'browser' | 'terminal' | null;
      feedbackFadingNodeIds?: Set<string>;
      activeNodeId?: string | null;
    }) => void,
    private triggerAutosave?: () => void,
    private archiveConfig?: ArchiveConfig
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

    const archiveDest = this.archiveConfig ? state.nodes[this.archiveConfig.archiveDestinationId] : null;

    return {
      collaboratingNodeId: this.collaboratingNodeId,
      collaboratingNode: { ...collaboratingNode },
      parentId,
      position: originalPosition,
      descendants,
      wasRootNode: state.rootNodeId === this.collaboratingNodeId,
      parentChildren: parent ? [...parent.children] : [],
      archiveDestinationChildren: archiveDest ? [...archiveDest.children] : undefined,
    };
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
      const effectiveIcon = getEffectiveBlueprintIcon(collaboratingNode, state.nodes, state.ancestorRegistry);
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
      const directChildIds = mergedNodesMap[this.collaboratingNodeId]?.children || [];
      newAncestorRegistry = addNodesToRegistry(registry, directChildIds, this.collaboratingNodeId, mergedNodesMap);
    }

    this.setState({
      nodes: mergedNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      collaborationSource: null,
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
      const effectiveIcon = getEffectiveBlueprintIcon(collaboratingNode, state.nodes, state.ancestorRegistry);
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
      newAncestorRegistry = addNodesToRegistry(newAncestorRegistry, [rootId], this.snapshot!.parentId, mergedNodesMap);
    }

    this.setState({
      nodes: mergedNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      collaborationSource: null,
      feedbackFadingNodeIds: new Set(this.createdNodeIds),
      activeNodeId: mappedRootIds[0],
    });
  }

  private moveNodeToArchive(
    updatedNodes: Record<string, TreeNode>,
    updatedRegistry: AncestorRegistry,
    archiveDestinationId: string
  ): AncestorRegistry {
    updatedNodes[this.collaboratingNodeId] = { ...this.snapshot!.collaboratingNode };
    this.snapshot!.descendants.forEach((node, nodeId) => {
      updatedNodes[nodeId] = { ...node };
    });

    updatedNodes[archiveDestinationId] = {
      ...updatedNodes[archiveDestinationId],
      children: [this.collaboratingNodeId, ...updatedNodes[archiveDestinationId].children],
    };

    return addNodesToRegistry(
      updatedRegistry,
      [this.collaboratingNodeId, ...Array.from(this.snapshot!.descendants.keys())],
      archiveDestinationId,
      updatedNodes
    );
  }

  private createArchiveSideLinks(
    updatedNodes: Record<string, TreeNode>,
    topLevelReplacementIds: string[],
    linkName: string
  ): void {
    const containerId = uuidv4();
    const containerNode: TreeNode = {
      id: containerId,
      content: linkName,
      children: [],
      metadata: { expanded: false },
    };

    for (const replacementId of topLevelReplacementIds) {
      const hyperlinkId = uuidv4();
      const replacementNode = updatedNodes[replacementId];
      updatedNodes[hyperlinkId] = {
        id: hyperlinkId,
        content: replacementNode?.content || '',
        children: [],
        metadata: { isHyperlink: true, linkedNodeId: replacementId },
      };
      containerNode.children.push(hyperlinkId);
      this.relationLinkNodeIds.push(hyperlinkId);
    }

    updatedNodes[containerId] = containerNode;
    this.relationLinkNodeIds.push(containerId);

    const archivedNode = updatedNodes[this.collaboratingNodeId];
    updatedNodes[this.collaboratingNodeId] = {
      ...archivedNode,
      children: [containerId, ...archivedNode.children],
    };
  }

  private createReplacementSideLinks(
    updatedNodes: Record<string, TreeNode>,
    topLevelReplacementIds: string[],
    linkName: string
  ): void {
    const archivedContent = updatedNodes[this.collaboratingNodeId]?.content || '';

    for (const replacementId of topLevelReplacementIds) {
      const containerId = uuidv4();
      const hyperlinkId = uuidv4();

      updatedNodes[containerId] = {
        id: containerId,
        content: linkName,
        children: [hyperlinkId],
        metadata: { expanded: false },
      };

      updatedNodes[hyperlinkId] = {
        id: hyperlinkId,
        content: archivedContent,
        children: [],
        metadata: { isHyperlink: true, linkedNodeId: this.collaboratingNodeId },
      };

      this.relationLinkNodeIds.push(containerId, hyperlinkId);

      const replacement = updatedNodes[replacementId];
      if (replacement) {
        updatedNodes[replacementId] = {
          ...replacement,
          children: [containerId, ...replacement.children],
        };
      }
    }
  }

  private updateRegistryForRelationLinks(
    updatedNodes: Record<string, TreeNode>,
    updatedRegistry: AncestorRegistry
  ): AncestorRegistry {
    let registry = updatedRegistry;
    for (const nodeId of this.relationLinkNodeIds) {
      if (!updatedNodes[nodeId]) continue;
      const parentId = Object.keys(updatedNodes).find(id =>
        updatedNodes[id].children.includes(nodeId)
      );
      if (parentId) {
        registry = addNodesToRegistry(registry, [nodeId], parentId, updatedNodes);
      }
    }
    return registry;
  }

  private executeArchive(): void {
    if (!this.archiveConfig || !this.snapshot) return;

    const state = this.getState();
    const { archiveDestinationId, archiveSideLinkName, replacementSideLinkName } = this.archiveConfig;

    if (!state.nodes[archiveDestinationId]) return;

    const updatedNodes = { ...state.nodes };
    let updatedRegistry = { ...state.ancestorRegistry };

    updatedRegistry = this.moveNodeToArchive(updatedNodes, updatedRegistry, archiveDestinationId);

    const topLevelReplacementIds = this.createdNodeIds.filter(id => {
      const parentNode = updatedNodes[this.snapshot!.parentId];
      return parentNode?.children.includes(id);
    });

    this.createArchiveSideLinks(updatedNodes, topLevelReplacementIds, archiveSideLinkName);
    this.createReplacementSideLinks(updatedNodes, topLevelReplacementIds, replacementSideLinkName);
    updatedRegistry = this.updateRegistryForRelationLinks(updatedNodes, updatedRegistry);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: updatedRegistry,
    });
  }

  execute(): void {
    const state = this.getState();
    const collaboratingNode = state.nodes[this.collaboratingNodeId];
    if (!collaboratingNode) return;

    if (!this.snapshot) {
      this.snapshot = this.captureSnapshot(collaboratingNode, state);
    }
    this.relationLinkNodeIds = [];

    if (this.isMultiRoot || this.archiveConfig) {
      this.executeMultiRoot(state, collaboratingNode);
    } else {
      this.executeSingleRoot(state, collaboratingNode);
    }

    if (this.archiveConfig) {
      this.executeArchive();
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
    for (const id of this.relationLinkNodeIds) {
      delete restoredNodesMap[id];
    }

    restoredNodesMap[this.snapshot.collaboratingNodeId] = { ...this.snapshot.collaboratingNode };
    this.snapshot.descendants.forEach((node, nodeId) => {
      restoredNodesMap[nodeId] = { ...node };
    });

    if ((this.isMultiRoot || this.archiveConfig) && !this.snapshot.wasRootNode) {
      const parentNode = restoredNodesMap[this.snapshot.parentId];
      if (parentNode) {
        restoredNodesMap[this.snapshot.parentId] = {
          ...parentNode,
          children: [...this.snapshot.parentChildren],
        };
      }
    }

    if (this.archiveConfig && this.snapshot.archiveDestinationChildren) {
      const archiveDest = restoredNodesMap[this.archiveConfig.archiveDestinationId];
      if (archiveDest) {
        restoredNodesMap[this.archiveConfig.archiveDestinationId] = {
          ...archiveDest,
          children: [...this.snapshot.archiveDestinationChildren],
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
      for (const id of this.relationLinkNodeIds) {
        delete registry[id];
      }
      newAncestorRegistry = addNodesToRegistry(registry, [this.collaboratingNodeId], this.snapshot.parentId, restoredNodesMap);
    }

    this.setState({
      nodes: restoredNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      collaboratingNodeId: null,
      collaborationSource: null,
      feedbackFadingNodeIds: new Set(),
      activeNodeId: this.snapshot.collaboratingNodeId,
    });

    this.triggerAutosave?.();
  }
}
