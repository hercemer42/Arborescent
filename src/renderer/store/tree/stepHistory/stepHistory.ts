import { v4 as uuidv4 } from 'uuid';
import { TreeNode } from '../../../../shared/types';
import { getAllDescendants } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../utils/ancestry';

export const STEP_HISTORY_MAX_ENTRIES = 10;

export function findOwningWorkflowStepId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
): string | null {
  const ancestors = ancestorRegistry[nodeId] ?? [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const candidate = nodes[ancestors[i]];
    if (candidate?.metadata?.stepType) return ancestors[i];
  }
  return null;
}

// Maximum visible length of a label after truncation, including any trailing ellipsis.
const PARENT_LABEL_MAX_LENGTH = 120;

export interface StepHistoryEntry {
  id: string;
  capturedAt: string;
  parentLabel: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
  position: number;
}

export type StepHistoryMap = Record<string, StepHistoryEntry[]>;

function truncateLabel(label: string): string {
  if (label.length <= PARENT_LABEL_MAX_LENGTH) return label;
  return `${label.slice(0, PARENT_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

export function captureRemappedSubtree(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
): { rootNodeId: string; nodes: Record<string, TreeNode> } {
  const root = nodes[rootNodeId];
  if (!root) return { rootNodeId, nodes: {} };

  const sourceIds = [rootNodeId, ...getAllDescendants(rootNodeId, nodes)];
  const idMap: Record<string, string> = {};
  for (const id of sourceIds) idMap[id] = uuidv4();

  const captured: Record<string, TreeNode> = {};
  for (const oldId of sourceIds) {
    const node = nodes[oldId];
    if (!node) continue;
    const newId = idMap[oldId];
    captured[newId] = {
      ...structuredClone(node),
      id: newId,
      children: node.children.map((childId) => idMap[childId] ?? childId),
    };
  }

  return { rootNodeId: idMap[rootNodeId], nodes: captured };
}

export function captureStepHistoryEntry(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  parentId: string,
  position: number,
): StepHistoryEntry {
  const historizedNode = nodes[rootNodeId];
  const parentLabel = historizedNode ? truncateLabel(historizedNode.content) : '';
  const remapped = captureRemappedSubtree(rootNodeId, nodes);
  return {
    id: uuidv4(),
    capturedAt: new Date().toISOString(),
    parentLabel,
    rootNodeId: remapped.rootNodeId,
    nodes: remapped.nodes,
    position,
  };
}

export function appendStepHistoryEntry(
  history: StepHistoryEntry[],
  entry: StepHistoryEntry,
  maxEntries: number = STEP_HISTORY_MAX_ENTRIES,
): StepHistoryEntry[] {
  const next = [...history, entry];
  if (next.length <= maxEntries) return next;
  return next.slice(next.length - maxEntries);
}

export function appendToStepHistoryMap(
  map: StepHistoryMap,
  stepId: string,
  entry: StepHistoryEntry,
): StepHistoryMap {
  const existing = map[stepId] ?? [];
  return {
    ...map,
    [stepId]: appendStepHistoryEntry(existing, entry),
  };
}
