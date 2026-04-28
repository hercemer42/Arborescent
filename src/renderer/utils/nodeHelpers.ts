import { TreeNode } from '../../shared/types';
import { AncestorRegistry, findClosestAncestor } from '../utils/ancestry';
import { exportNodeAsMarkdown, exportContextAsMarkdown } from './markdown';

// Tree navigation / cloning / summary filtering live in sibling modules
// now; re-exported below for call-site back-compat. New call sites
// should import from the focused modules directly.
export {
  findPreviousNode,
  findNextNode,
  isLastRootLevelNode,
  getNextSiblingId,
  captureNodePosition,
  getVisibleNodesInOrder,
  sortNodeIdsByTreeOrder,
} from './treeNavigation';
export { computeSummaryVisibleNodeIds } from './summaryFilters';
export { cloneNodesWithNewIds } from './nodeCloning';

export const BASIC_EXECUTE_CONTEXT_ID = '__basic_execute__';
export const BASIC_REVIEW_CONTEXT_ID = '__basic_review__';

function isSyntheticContextId(id: string): boolean {
  return id === BASIC_EXECUTE_CONTEXT_ID || id === BASIC_REVIEW_CONTEXT_ID;
}

export function getAppliedContextIdWithInheritance(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  const appliedId = node.metadata.appliedContextId as string | undefined;
  if (appliedId && (nodes[appliedId] || isSyntheticContextId(appliedId))) {
    return appliedId;
  }

  return getInheritedContextId(nodeId, nodes, ancestorRegistry);
}

export function getInheritedContextId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  return findClosestAncestor(nodeId, nodes, ancestorRegistry, (ancestor) => {
    const ancestorAppliedId = ancestor.metadata.appliedContextId as string | undefined;
    if (ancestorAppliedId && (nodes[ancestorAppliedId] || isSyntheticContextId(ancestorAppliedId))) {
      return ancestorAppliedId;
    }
    return undefined;
  });
}

export function resolveHyperlinkedContexts(
  contextNodeId: string,
  nodes: Record<string, TreeNode>
): string[] {
  const contextNode = nodes[contextNodeId];
  if (!contextNode) return [];

  const result: string[] = [];
  const descendantIds = getAllDescendants(contextNodeId, nodes);

  for (const descendantId of descendantIds) {
    const descendant = nodes[descendantId];
    if (!descendant) continue;

    if (descendant.metadata.isHyperlink === true) {
      const linkedNodeId = descendant.metadata.linkedNodeId as string | undefined;
      if (!linkedNodeId) continue;
      if (!nodes[linkedNodeId]) continue;
      if (linkedNodeId === contextNodeId) continue;
      if (!result.includes(linkedNodeId)) {
        result.push(linkedNodeId);
      }
    }
  }

  return result;
}

export function getContextsForCollaboration(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string[] {
  const node = nodes[nodeId];
  if (!node) return [];

  const activeContextId = getAppliedContextIdWithInheritance(nodeId, nodes, ancestorRegistry);
  if (!activeContextId || isSyntheticContextId(activeContextId)) {
    return [];
  }

  return [activeContextId];
}

export function buildContentWithContext(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  resolveHyperlinks: boolean = false
): { contextPrefix: string; nodeContent: string } {
  const node = nodes[nodeId];
  if (!node) return { contextPrefix: '', nodeContent: '' };

  let nodeContent: string;
  if (resolveHyperlinks && isBlueprintNode(nodeId, nodes, ancestorRegistry)) {
    nodeContent = exportContextAsMarkdown(node, nodes, 0, new Set([nodeId]));
  } else {
    nodeContent = exportNodeAsMarkdown(node, nodes);
  }

  let contextPrefix = '';
  const contextIds = getContextsForCollaboration(nodeId, nodes, ancestorRegistry);
  for (const contextId of contextIds) {
    const contextNode = nodes[contextId];
    if (contextNode) {
        contextPrefix += exportContextAsMarkdown(contextNode, nodes, 0, new Set([contextId])) + '\n';
    }
  }

  return { contextPrefix, nodeContent };
}

export function findClosestAncestorWithMetadata(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  metadataKey: string
): string | null {
  const node = nodes[nodeId];
  if (node?.metadata[metadataKey] === true) {
    return nodeId;
  }

  const ancestorId = findClosestAncestor(nodeId, nodes, ancestorRegistry, (ancestor) =>
    ancestor.metadata[metadataKey] === true ? ancestor.id : undefined
  );

  return ancestorId || null;
}

export function updateNodeMetadata(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  metadataUpdates: Partial<TreeNode['metadata']>
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        ...metadataUpdates,
      },
    },
  };
}

export function getAllDescendants(nodeId: string, nodes: Record<string, TreeNode>): string[] {
  const node = nodes[nodeId];
  if (!node || node.children.length === 0) {
    return [];
  }

  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId);
    descendants.push(...getAllDescendants(childId, nodes));
  }
  return descendants;
}

export function getNodeAndDescendantIds(
  rootIds: string[],
  nodes: Record<string, TreeNode>
): string[] {
  const result: string[] = [];
  for (const rootId of rootIds) {
    if (nodes[rootId]) {
      result.push(rootId);
      result.push(...getAllDescendants(rootId, nodes));
    }
  }
  return result;
}

export { getParentId, getParentIdOrNull } from './parentLookup';
export { createTreeNode, wrapNodesWithHiddenRoot, type CreateTreeNodeOptions } from './nodeConstruction';

export type DropZone = 'before' | 'after' | 'child';

export function isValidDrop(
  nodeId: string,
  targetNodeId: string,
  dropZone: DropZone,
  nodesToMove: string[],
  ancestorRegistry: AncestorRegistry
): boolean {
  if (nodeId === targetNodeId) {
    return false;
  }

  const targetAncestors = ancestorRegistry[targetNodeId] || [];
  if (targetAncestors.includes(nodeId)) {
    return false;
  }

  if (dropZone !== 'child' && nodesToMove.includes(targetNodeId)) {
    return false;
  }

  return true;
}

export function getContextDeclarations(
  nodes: Record<string, TreeNode>
): { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[] {
  return Object.values(nodes)
    .filter(node => node.metadata.isContextDeclaration === true)
    .map(node => ({
      nodeId: node.id,
      content: node.content || 'Untitled context',
      icon: (node.metadata.blueprintIcon as string) || 'lightbulb',
      color: node.metadata.blueprintColor as string | undefined,
      mode: (node.metadata.contextMode as 'collaborate' | 'execute') || 'collaborate',
    }))
    .sort((a, b) => a.content.localeCompare(b.content));
}

export function resolveContextMode(
  contextId: string | undefined,
  nodes: Record<string, TreeNode>,
  contextDeclarations: { nodeId: string; mode: 'collaborate' | 'execute' }[],
): 'collaborate' | 'execute' {
  if (!contextId) return 'collaborate';
  if (contextId === BASIC_EXECUTE_CONTEXT_ID) return 'execute';
  if (contextId === BASIC_REVIEW_CONTEXT_ID) return 'collaborate';
  const declaration = contextDeclarations.find(d => d.nodeId === contextId);
  if (declaration) return declaration.mode;
  const contextNode = nodes[contextId];
  if (contextNode) {
    return (contextNode.metadata.contextMode as 'collaborate' | 'execute') || 'collaborate';
  }
  return 'collaborate';
}

export function resolveSendContextName(
  contextId: string | undefined,
  nodes: Record<string, TreeNode>,
): string | undefined {
  if (!contextId) return undefined;
  if (contextId === BASIC_EXECUTE_CONTEXT_ID) return 'Basic execution';
  if (contextId === BASIC_REVIEW_CONTEXT_ID) return 'Basic review';
  const contextNode = nodes[contextId];
  if (!contextNode) return undefined;
  const content = contextNode.content;
  return content.length > 40 ? content.slice(0, 40) + '...' : content;
}

export function getContextDeclarationId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  if (node.metadata.isContextDeclaration === true) {
    return node.id;
  }

  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.isContextDeclaration === true) {
      return ancestors[i];
    }
  }
  return undefined;
}

export function getIsContextChild(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const node = nodes[nodeId];
  if (!node || node.metadata.isContextDeclaration) return false;

  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.isContextDeclaration) {
      return true;
    }
  }
  return false;
}

export function isBlueprintNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const node = nodes[nodeId];
  if (!node) return false;
  if (node.metadata.isBlueprint === true) return true;
  if (node.metadata.isContextDeclaration === true) return true;
  return getIsContextChild(nodeId, nodes, ancestorRegistry);
}

export function shouldInheritBlueprint(
  parentId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const parent = nodes[parentId];
  if (!parent) return false;
  return parent.metadata.isContextDeclaration === true
    || parent.metadata.isWorkflow === true
    || getIsContextChild(parentId, nodes, ancestorRegistry);
}

export function getInheritedBlueprintIcon(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { icon: string; color: string | undefined } | undefined {
  const node = nodes[nodeId];
  if (!node || node.metadata.blueprintIcon) return undefined;

  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.blueprintIcon) {
      return {
        icon: ancestor.metadata.blueprintIcon as string,
        color: ancestor.metadata.blueprintColor as string | undefined,
      };
    }
  }
  return undefined;
}
