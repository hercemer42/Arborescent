import { ArboFile, TreeNode, PendingProposalMap } from '../../shared/types';
import { stripDroppedSessionFields } from './sessionRegistryMigrations';

const RUNTIME_ONLY_FIELDS = ['transient'] as const;

function stripRuntimeOnlyMetadata(node: TreeNode): TreeNode {
  const { metadata } = node;
  if (metadata.transient === undefined) return node;

  const cleaned: typeof metadata = { ...metadata };
  for (const field of RUNTIME_ONLY_FIELDS) delete cleaned[field];
  return { ...node, metadata: cleaned };
}

function stripTransientMetadataFromNodes(
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const withoutDropped = stripDroppedSessionFields(nodes);
  const result: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(withoutDropped)) {
    result[id] = stripRuntimeOnlyMetadata(node);
  }
  return result;
}

export function extractBlueprintNodes(
  nodes: Record<string, TreeNode>,
  rootNodeId: string
): Record<string, TreeNode> {
  const result: Record<string, TreeNode> = {};

  function collectBlueprintNode(nodeId: string): void {
    const node = nodes[nodeId];
    if (!node) return;

    if (node.metadata.isBlueprint) {
      result[nodeId] = {
        ...node,
        children: node.children.filter((childId) => {
          const child = nodes[childId];
          return child?.metadata.isBlueprint;
        }),
      };
    }

    for (const childId of node.children) {
      collectBlueprintNode(childId);
    }
  }

  collectBlueprintNode(rootNodeId);
  return result;
}

export function createArboFile(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  existingMeta?: { created: string; author: string },
  isBlueprint?: boolean,
  summaryDateFrom?: string | null,
  summaryDateTo?: string | null,
  sessionRegistry?: Record<string, { cwd: string }>,
  pendingProposals?: PendingProposalMap,
): ArboFile {
  const file: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: existingMeta?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    author: existingMeta?.author || 'unknown',
    rootNodeId,
    nodes: stripTransientMetadataFromNodes(nodes),
  };

  if (isBlueprint) {
    file.isBlueprint = true;
  }

  if (summaryDateFrom) {
    file.summaryDateFrom = summaryDateFrom;
  }

  if (summaryDateTo) {
    file.summaryDateTo = summaryDateTo;
  }

  if (sessionRegistry && Object.keys(sessionRegistry).length > 0) {
    file.sessionRegistry = sessionRegistry;
  }

  if (pendingProposals && Object.keys(pendingProposals).length > 0) {
    file.pendingProposals = pendingProposals;
  }

  return file;
}
