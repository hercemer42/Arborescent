import type { TreeNode } from '../../shared/types';
import type { AncestorRegistry } from './ancestry';
import { getParentIdOrNull } from './parentLookup';
import { extractTaskTitle } from './terminalTabTitle';

export interface FindingRegisterEntry {
  id: string;
  title: string;
  weight: number;
}

export type WeightBand = 'muted' | 'amber' | 'red';

const AMBER_FROM = 4;
const RED_FROM = 6;

export function getWeightBand(weight: number): WeightBand {
  if (weight >= RED_FROM) return 'red';
  if (weight >= AMBER_FROM) return 'amber';
  return 'muted';
}

export function isBackLink(node: TreeNode | undefined): boolean {
  return node?.metadata.isHyperlink === true;
}

// Weight is the back-link count, derived here rather than stored, so it cannot
// drift from the evidence and a retried write cannot double-count it.
export function getFindingWeight(findingId: string, nodes: Record<string, TreeNode>): number {
  const finding = nodes[findingId];
  if (!finding) return 0;
  return finding.children.filter((childId) => isBackLink(nodes[childId])).length;
}

function isFindingsRoot(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  return nodes[nodeId]?.metadata.isFindingsRoot === true;
}

export function isFinding(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
): boolean {
  if (isBackLink(nodes[nodeId])) return false;
  const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
  return parentId !== null && isFindingsRoot(parentId, nodes);
}

export function buildFindingsRegister(
  destinationId: string | undefined,
  nodes: Record<string, TreeNode>,
): FindingRegisterEntry[] {
  if (!destinationId) return [];
  const destination = nodes[destinationId];
  if (!destination) return [];

  return destination.children
    .filter((childId) => nodes[childId] && !isBackLink(nodes[childId]))
    .map((childId) => ({
      id: childId,
      // One line per entry, so a hand-written multi-line finding cannot emit
      // trailing lines that read as further entries carrying no id.
      title: extractTaskTitle(nodes[childId]),
      weight: getFindingWeight(childId, nodes),
    }));
}

// Titles and weights only: identifying which finding to update needs nothing
// more, and a description would make every later debrief pay for text the
// session cannot act on.
export function renderFindingsRegister(
  destinationId: string | undefined,
  nodes: Record<string, TreeNode>,
): string {
  return buildFindingsRegister(destinationId, nodes)
    .map((entry) => `- ${entry.id} — ${entry.title} (weight ${entry.weight})`)
    .join('\n');
}
