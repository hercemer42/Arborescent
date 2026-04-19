import { TreeNode } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

function cloneNodeTreeRecursive(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  idMapping: Record<string, string>,
  newNodesMap: Record<string, TreeNode>
): void {
  const node = nodes[nodeId];
  if (!node || idMapping[nodeId]) return;

  const newId = uuidv4();
  idMapping[nodeId] = newId;

  for (const childId of node.children) {
    cloneNodeTreeRecursive(childId, nodes, idMapping, newNodesMap);
  }

  const clonedNode: TreeNode = {
    ...structuredClone(node),
    id: newId,
    children: node.children.map((childId) => idMapping[childId] || childId),
  };
  newNodesMap[newId] = clonedNode;
}

/**
 * Deep-clone one or more subtrees, assigning fresh UUIDs to every node
 * and preserving the child-id references via an id-mapping the caller
 * can inspect.
 */
export function cloneNodesWithNewIds(
  rootNodeIds: string[],
  nodes: Record<string, TreeNode>
): { newRootNodes: TreeNode[]; newNodesMap: Record<string, TreeNode>; idMapping: Record<string, string> } {
  const idMapping: Record<string, string> = {};
  const newNodesMap: Record<string, TreeNode> = {};

  for (const rootId of rootNodeIds) {
    cloneNodeTreeRecursive(rootId, nodes, idMapping, newNodesMap);
  }

  const newRootNodes = rootNodeIds
    .map((oldId) => newNodesMap[idMapping[oldId]])
    .filter(Boolean);

  return { newRootNodes, newNodesMap, idMapping };
}
