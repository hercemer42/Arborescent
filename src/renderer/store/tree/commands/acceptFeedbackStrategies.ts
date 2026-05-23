import { v4 as uuidv4 } from 'uuid';
import type { TreeNode } from '../../../../shared/types';
import {
  addNodesToRegistry,
  buildAncestorRegistry,
  type AncestorRegistry,
} from '../../../utils/ancestry';
import { getAllDescendants } from '../../../utils/nodeHelpers';
import { getEffectiveBlueprintIcon } from '../../../utils/blueprintInheritance';
import { bindSessionInNodes } from '../actions/bindSessionToNode';

/**
 * Pure execution strategies for AcceptFeedbackCommand.
 *
 * The command has two distinct execution paths:
 *  - single-root: the feedback has one root node that REPLACES the
 *    collaborating node in place (same id preserved).
 *  - multi-root: the feedback has multiple root nodes that REPLACE the
 *    collaborating node's slot in its parent (new ids, original
 *    collaborating node is removed).
 *
 * The multi-root path falls back to single-root when the collaborating
 * node was the tree root — replacing the root with multiple siblings
 * doesn't make sense, so we treat the first root as a full replacement.
 *
 * These strategies are pure: they take inputs (state snapshots, the
 * captured CollaborationSnapshot, precomputed idMap, preservedMetadata)
 * and return the `{ nodes, ancestorRegistry, createdNodeIds, activeNodeId }`
 * tuple the caller uses to drive setState. No mutation of shared instance
 * fields — the command now captures `createdNodeIds` from the returned
 * value rather than the strategy poking at `this`.
 */

export interface CollaborationSnapshot {
  collaboratingNodeId: string;
  collaboratingNode: TreeNode;
  parentId: string;
  position: number;
  descendants: Map<string, TreeNode>;
  wasRootNode: boolean;
  parentChildren: string[];
  archiveDestinationChildren?: string[];
}

export interface StrategyState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  blueprintModeEnabled: boolean;
}

export interface StrategyInput {
  state: StrategyState;
  collaboratingNode: TreeNode;
  collaboratingNodeId: string;
  newRootNodeIds: string[];
  newNodesMap: Record<string, TreeNode>;
  idMap: Record<string, string>;
  preservedMetadata: Record<string, unknown>;
  snapshot: CollaborationSnapshot;
}

export interface StrategyOutput {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  createdNodeIds: string[];
  activeNodeId: string;
}

export function applyBlueprintMetadata(
  nodesMap: Record<string, TreeNode>,
  rootNodeIds: string[],
  blueprintIcon: { icon: string; color?: string },
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

function stripFeedbackReconcileMetadata(metadata: TreeNode['metadata']): TreeNode['metadata'] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { feedbackBaselineKind, feedbackPriorContent, sessionId, ...rest } = metadata;
  return rest;
}

function stripGroupIdFromMetadata(metadata: TreeNode['metadata']): TreeNode['metadata'] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { groupId, ...rest } = metadata;
  return rest;
}

export const PRESERVED_METADATA_KEYS = [
  'appliedContextIds',
  'activeContextId',
  'appliedContextId',
  'isContextDeclaration',
  'blueprintIcon',
  'blueprintColor',
  'isBlueprint',
  'expanded',
  'groupId',
] as const;

export function collectPreservedMetadata(collaboratingNode: TreeNode): Record<string, unknown> {
  const preserved: Record<string, unknown> = {};
  for (const key of PRESERVED_METADATA_KEYS) {
    if (collaboratingNode.metadata[key] !== undefined) {
      preserved[key] = collaboratingNode.metadata[key];
    }
  }
  return preserved;
}

export function executeSingleRootStrategy(input: StrategyInput): StrategyOutput {
  const {
    state,
    collaboratingNode,
    collaboratingNodeId,
    newRootNodeIds,
    newNodesMap,
    idMap,
    preservedMetadata,
    snapshot,
  } = input;

  const newRootNodeId = newRootNodeIds[0];

  let updatedNewNodesMap: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(newNodesMap)) {
    const newId = idMap[id];
    const remappedChildren = node.children.map((childId) => idMap[childId] || childId);
    const sanitizedMetadata = stripFeedbackReconcileMetadata(node.metadata);

    if (id === newRootNodeId) {
      updatedNewNodesMap[newId] = {
        ...node,
        id: newId,
        children: remappedChildren,
        metadata: { ...sanitizedMetadata, ...preservedMetadata },
      };
    } else {
      updatedNewNodesMap[newId] = {
        ...node,
        id: newId,
        children: remappedChildren,
        metadata: sanitizedMetadata,
      };
    }
  }

  if (state.blueprintModeEnabled || collaboratingNode.metadata.isBlueprint) {
    const effectiveIcon = getEffectiveBlueprintIcon(
      collaboratingNode,
      state.nodes,
      state.ancestorRegistry,
    );
    updatedNewNodesMap = applyBlueprintMetadata(
      updatedNewNodesMap,
      [collaboratingNodeId],
      effectiveIcon,
    );
  }

  let mergedNodesMap: Record<string, TreeNode> = { ...state.nodes };
  for (const id of snapshot.descendants.keys()) {
    delete mergedNodesMap[id];
  }
  Object.assign(mergedNodesMap, updatedNewNodesMap);

  // Single-root replaces the source's content in-place under its original id;
  // re-stamp the source's sessionId via bindSessionInNodes so the terminal binding
  // survives refinement (sessionId is otherwise dropped because it's no longer in
  // PRESERVED_METADATA_KEYS — the bind-only write site keeps the uniqueness invariant).
  const sourceSessionId = collaboratingNode.metadata.sessionId;
  if (typeof sourceSessionId === 'string' && sourceSessionId.length > 0) {
    mergedNodesMap = bindSessionInNodes(mergedNodesMap, sourceSessionId, collaboratingNodeId);
  }

  const createdNodeIds = [
    collaboratingNodeId,
    ...getAllDescendants(collaboratingNodeId, updatedNewNodesMap),
  ];

  let newAncestorRegistry: AncestorRegistry;
  if (snapshot.wasRootNode) {
    newAncestorRegistry = buildAncestorRegistry(collaboratingNodeId, mergedNodesMap);
  } else {
    const registry = { ...state.ancestorRegistry };
    for (const descendantId of snapshot.descendants.keys()) {
      delete registry[descendantId];
    }
    const directChildIds = mergedNodesMap[collaboratingNodeId]?.children || [];
    newAncestorRegistry = addNodesToRegistry(
      registry,
      directChildIds,
      collaboratingNodeId,
      mergedNodesMap,
    );
  }

  return {
    nodes: mergedNodesMap,
    ancestorRegistry: newAncestorRegistry,
    createdNodeIds,
    activeNodeId: collaboratingNodeId,
  };
}

export function executeMultiRootStrategy(input: StrategyInput): StrategyOutput {
  const {
    state,
    collaboratingNode,
    collaboratingNodeId,
    newRootNodeIds,
    newNodesMap,
    idMap,
    preservedMetadata,
    snapshot,
  } = input;

  // Root-of-tree feedback can't splice alongside — fall back to single-root.
  if (snapshot.wasRootNode) {
    return executeSingleRootStrategy(input);
  }

  // Every output tree root from this decomposition shares one fresh groupId,
  // overriding any inbound or preserved-from-source groupId. Descendants within
  // an output tree never carry groupId.
  const freshGroupId = uuidv4();
  const rootPreservedMetadata = { ...preservedMetadata, groupId: freshGroupId };

  let updatedNewNodesMap: Record<string, TreeNode> = {};
  const newRootIdSet = new Set(newRootNodeIds);

  for (const [id, node] of Object.entries(newNodesMap)) {
    const newId = idMap[id];
    const remappedChildren = node.children.map((childId) => idMap[childId] || childId);
    const isRoot = newRootIdSet.has(id);
    const sanitizedMetadata = stripFeedbackReconcileMetadata(node.metadata);
    const finalMetadata = isRoot
      ? { ...sanitizedMetadata, ...rootPreservedMetadata }
      : stripGroupIdFromMetadata(sanitizedMetadata);

    updatedNewNodesMap[newId] = {
      ...node,
      id: newId,
      children: remappedChildren,
      metadata: finalMetadata,
    };
  }

  if (state.blueprintModeEnabled || collaboratingNode.metadata.isBlueprint) {
    const effectiveIcon = getEffectiveBlueprintIcon(
      collaboratingNode,
      state.nodes,
      state.ancestorRegistry,
    );
    const mappedRootIds = newRootNodeIds.map((id) => idMap[id]);
    updatedNewNodesMap = applyBlueprintMetadata(updatedNewNodesMap, mappedRootIds, effectiveIcon);
  }

  const mergedNodesMap = { ...state.nodes };
  delete mergedNodesMap[collaboratingNodeId];
  for (const id of snapshot.descendants.keys()) {
    delete mergedNodesMap[id];
  }
  Object.assign(mergedNodesMap, updatedNewNodesMap);

  const mappedRootIds = newRootNodeIds.map((id) => idMap[id]);
  const parentNode = mergedNodesMap[snapshot.parentId];
  if (parentNode) {
    const newChildren = [...parentNode.children];
    const collabIndex = newChildren.indexOf(collaboratingNodeId);
    if (collabIndex >= 0) {
      newChildren.splice(collabIndex, 1, ...mappedRootIds);
    } else {
      newChildren.push(...mappedRootIds);
    }
    mergedNodesMap[snapshot.parentId] = {
      ...parentNode,
      children: newChildren,
    };
  }

  const createdNodeIds: string[] = [];
  for (const rootId of mappedRootIds) {
    createdNodeIds.push(rootId, ...getAllDescendants(rootId, updatedNewNodesMap));
  }

  const registry = { ...state.ancestorRegistry };
  delete registry[collaboratingNodeId];
  for (const descendantId of snapshot.descendants.keys()) {
    delete registry[descendantId];
  }
  let newAncestorRegistry = registry;
  for (const rootId of mappedRootIds) {
    newAncestorRegistry = addNodesToRegistry(
      newAncestorRegistry,
      [rootId],
      snapshot.parentId,
      mergedNodesMap,
    );
  }

  return {
    nodes: mergedNodesMap,
    ancestorRegistry: newAncestorRegistry,
    createdNodeIds,
    activeNodeId: mappedRootIds[0],
  };
}
