import { v4 as uuidv4 } from 'uuid';
import type { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, type AncestorRegistry } from '../../../utils/ancestry';

/**
 * Side-link and archival helpers used by AcceptFeedbackCommand when a
 * step has an archiveDestinationId configured. Kept as pure free
 * functions so the archive flow can be reasoned about without the
 * command's snapshot bookkeeping in the way.
 *
 * All helpers mutate the `updatedNodes` record the caller passes in,
 * matching the command's in-place style. The caller is responsible for
 * tracking created node ids in its own `relationLinkNodeIds` list.
 */

export function moveNodeToArchive(
  updatedNodes: Record<string, TreeNode>,
  updatedRegistry: AncestorRegistry,
  archiveDestinationId: string,
  collaboratingNodeId: string,
  collaboratingNode: TreeNode,
  descendants: Map<string, TreeNode>
): AncestorRegistry {
  updatedNodes[collaboratingNodeId] = { ...collaboratingNode };
  descendants.forEach((node, nodeId) => {
    updatedNodes[nodeId] = { ...node };
  });

  updatedNodes[archiveDestinationId] = {
    ...updatedNodes[archiveDestinationId],
    children: [collaboratingNodeId, ...updatedNodes[archiveDestinationId].children],
  };

  return addNodesToRegistry(
    updatedRegistry,
    [collaboratingNodeId, ...Array.from(descendants.keys())],
    archiveDestinationId,
    updatedNodes
  );
}

/**
 * Attach a container-of-hyperlinks group to the archived node, pointing
 * at each replacement root. Returns the newly-created node ids for the
 * caller's relation-link bookkeeping.
 */
export function createArchiveSideLinks(
  updatedNodes: Record<string, TreeNode>,
  topLevelReplacementIds: string[],
  linkName: string,
  collaboratingNodeId: string
): string[] {
  const created: string[] = [];
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
    created.push(hyperlinkId);
  }

  updatedNodes[containerId] = containerNode;
  created.push(containerId);

  const archivedNode = updatedNodes[collaboratingNodeId];
  updatedNodes[collaboratingNodeId] = {
    ...archivedNode,
    children: [containerId, ...archivedNode.children],
  };

  return created;
}

/**
 * Attach a container-of-hyperlinks group under each replacement root,
 * pointing back to the archived original.
 */
export function createReplacementSideLinks(
  updatedNodes: Record<string, TreeNode>,
  topLevelReplacementIds: string[],
  linkName: string,
  collaboratingNodeId: string
): string[] {
  const created: string[] = [];
  const archivedContent = updatedNodes[collaboratingNodeId]?.content || '';

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
      metadata: { isHyperlink: true, linkedNodeId: collaboratingNodeId },
    };

    created.push(containerId, hyperlinkId);

    const replacement = updatedNodes[replacementId];
    if (replacement) {
      updatedNodes[replacementId] = {
        ...replacement,
        children: [containerId, ...replacement.children],
      };
    }
  }

  return created;
}

/**
 * After createArchiveSideLinks / createReplacementSideLinks have mutated
 * `updatedNodes`, walk the created ids and register them in the
 * ancestor registry under their actual parents.
 */
export function updateRegistryForRelationLinks(
  updatedNodes: Record<string, TreeNode>,
  updatedRegistry: AncestorRegistry,
  relationLinkNodeIds: string[]
): AncestorRegistry {
  let registry = updatedRegistry;
  for (const nodeId of relationLinkNodeIds) {
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
