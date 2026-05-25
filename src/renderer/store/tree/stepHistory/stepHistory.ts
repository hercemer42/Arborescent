import { v4 as uuidv4 } from 'uuid';
import { TreeNode } from '../../../../shared/types';
import { getAllDescendants } from '../../../utils/nodeHelpers';

export const STEP_HISTORY_MAX_ENTRIES = 10;

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

function collectSubtree(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
): Record<string, TreeNode> {
  const captured: Record<string, TreeNode> = {};
  const root = nodes[rootNodeId];
  if (!root) return captured;
  captured[rootNodeId] = structuredClone(root);
  for (const id of getAllDescendants(rootNodeId, nodes)) {
    const node = nodes[id];
    if (node) captured[id] = structuredClone(node);
  }
  return captured;
}

export function captureStepHistoryEntry(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  parentId: string,
  position: number,
): StepHistoryEntry {
  const parentNode = nodes[parentId];
  const parentLabel = parentNode ? truncateLabel(parentNode.content) : '';
  return {
    id: uuidv4(),
    capturedAt: new Date().toISOString(),
    parentLabel,
    rootNodeId,
    nodes: collectSubtree(rootNodeId, nodes),
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
