import { v4 as uuidv4 } from 'uuid';
import type { TreeNode } from '../../shared/types';
import type { AncestorRegistry } from './ancestry';
import { addNodeToRegistry } from './ancestry';
import { createTreeNode } from './nodeConstruction';
import { shouldInheritBlueprint } from './nodeHelpers';
import { isBackLink } from './findings';

export interface TreeSlice {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
}

interface TouchedFinding {
  touchedNodeId: string;
  subjectNodeId: string;
  findingsRootId: string;
}

type EvidenceRequest =
  | (TouchedFinding & { mode: 'created'; createdNodeId: string })
  | (TouchedFinding & { mode: 'revised' });

function findTouchedFindingId(
  touchedNodeId: string,
  findingsRootId: string,
  { ancestorRegistry }: TreeSlice,
): string | undefined {
  const chain = [...(ancestorRegistry[touchedNodeId] ?? []), touchedNodeId];
  const rootIndex = chain.indexOf(findingsRootId);
  if (rootIndex === -1) return undefined;
  return chain[rootIndex + 1];
}

function hasBackLinkTo(findingId: string, subjectNodeId: string, nodes: Record<string, TreeNode>): boolean {
  return (nodes[findingId]?.children ?? []).some(
    (childId) => isBackLink(nodes[childId]) && nodes[childId].metadata.linkedNodeId === subjectNodeId,
  );
}

// Evidence nodes carry no status: a Findings subtree is statusless, and the
// weight badge already occupies the position a checkbox would. Blueprint
// inheritance still applies, so a finding and its children agree.
function appendChild(
  slice: TreeSlice,
  parentId: string,
  content: string,
  metadata: Record<string, unknown>,
): TreeSlice {
  const childId = uuidv4();
  const parent = slice.nodes[parentId];
  if (shouldInheritBlueprint(parentId, slice.nodes, slice.ancestorRegistry)) {
    metadata = { ...metadata, isBlueprint: true };
  }
  return {
    nodes: {
      ...slice.nodes,
      [childId]: createTreeNode(childId, { content, metadata }),
      [parentId]: { ...parent, children: [...parent.children, childId] },
    },
    ancestorRegistry: addNodeToRegistry(slice.ancestorRegistry, childId, parentId),
  };
}

// The session writes a finding as one node because add_child_node answers with
// no id, leaving it unable to address what it just created. The first non-empty
// line is the headline the register carries; the remainder becomes the
// description child the tree reads as one keystroke away.
function splitFindingContent(content: string): { title: string; description: string } {
  const lines = content.split('\n');
  const titleIndex = lines.findIndex((line) => line.trim() !== '');
  if (titleIndex === -1) return { title: content.trim(), description: '' };
  return {
    title: lines[titleIndex].trim(),
    description: lines.slice(titleIndex + 1).join('\n').trim(),
  };
}

function settleNewFinding(slice: TreeSlice, findingId: string): TreeSlice {
  const finding = slice.nodes[findingId];
  const { title, description } = splitFindingContent(finding.content);

  const collapsed: TreeSlice = {
    ...slice,
    nodes: {
      ...slice.nodes,
      [findingId]: { ...finding, content: title, metadata: { ...finding.metadata, expanded: false } },
    },
  };

  return description ? appendChild(collapsed, findingId, description, {}) : collapsed;
}

// A back-link is the unit of evidence and the app owns it: add_child_node cannot
// set metadata, so the session can never create one. Attaching is idempotent on
// the subject, so a retried, resumed or re-sent debrief cannot inflate a weight.
// A revision is itself a recurrence report and earns one on the same terms.
export function recordFindingEvidence(slice: TreeSlice, request: EvidenceRequest): TreeSlice {
  const { findingsRootId } = request;
  if (!slice.nodes[findingsRootId]) return slice;

  const newFindingId =
    request.mode === 'created' && request.touchedNodeId === findingsRootId ? request.createdNodeId : undefined;
  const settled = newFindingId ? settleNewFinding(slice, newFindingId) : slice;

  const findingId = newFindingId ?? findTouchedFindingId(request.touchedNodeId, findingsRootId, settled);
  if (!findingId || !settled.nodes[findingId]) return settled;
  if (hasBackLinkTo(findingId, request.subjectNodeId, settled.nodes)) return settled;

  const subject = settled.nodes[request.subjectNodeId];
  return appendChild(settled, findingId, subject?.content || request.subjectNodeId, {
    isHyperlink: true,
    linkedNodeId: request.subjectNodeId,
  });
}
