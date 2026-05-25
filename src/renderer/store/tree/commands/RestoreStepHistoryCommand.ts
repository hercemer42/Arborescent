import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, removeNodeFromRegistry } from '../../../utils/ancestry';
import type { AncestorRegistry } from '../../../utils/ancestry';
import { StepHistoryEntry, StepHistoryMap } from '../stepHistory/stepHistory';
import { v4 as uuidv4 } from 'uuid';

interface RestoreSnapshot {
  insertedNodeIds: string[];
  insertedRootId: string;
  parentId: string;
  position: number;
}

interface RestoreState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  stepHistory?: StepHistoryMap;
}

interface RestoreStateUpdate {
  nodes?: Record<string, TreeNode>;
  ancestorRegistry?: AncestorRegistry;
  activeNodeId?: string;
}

function remapSubtree(
  entry: StepHistoryEntry,
): { rootId: string; nodes: Record<string, TreeNode>; ids: string[] } {
  const idMap: Record<string, string> = {};
  for (const oldId of Object.keys(entry.nodes)) {
    idMap[oldId] = uuidv4();
  }

  const newNodes: Record<string, TreeNode> = {};
  for (const [oldId, node] of Object.entries(entry.nodes)) {
    const newId = idMap[oldId];
    newNodes[newId] = {
      ...structuredClone(node),
      id: newId,
      children: node.children.map((childId) => idMap[childId] ?? childId),
    };
  }

  return {
    rootId: idMap[entry.rootNodeId],
    nodes: newNodes,
    ids: Object.keys(newNodes),
  };
}

export class RestoreStepHistoryCommand extends BaseCommand {
  private snapshot: RestoreSnapshot | null = null;
  public touchedNodeIds: Set<string> = new Set();

  constructor(
    private stepId: string,
    private entryId: string,
    private getState: () => RestoreState,
    private setState: (partial: RestoreStateUpdate) => void,
    private triggerAutosave?: () => void,
  ) {
    super();
    this.description = `Restore step history entry ${entryId}`;
  }

  execute(): void {
    const { nodes, ancestorRegistry, stepHistory } = this.getState();
    const stepNode = nodes[this.stepId];
    const entry = stepHistory?.[this.stepId]?.find((e) => e.id === this.entryId);
    if (!stepNode || !entry) return;

    const { rootId, nodes: clonedNodes, ids } = remapSubtree(entry);

    const updatedNodes: Record<string, TreeNode> = { ...nodes, ...clonedNodes };

    const desiredPosition = entry.position;
    const childCount = stepNode.children.length;
    const insertAt = desiredPosition >= 0 && desiredPosition <= childCount ? desiredPosition : childCount;

    const updatedChildren = [...stepNode.children];
    updatedChildren.splice(insertAt, 0, rootId);
    updatedNodes[this.stepId] = { ...stepNode, children: updatedChildren };

    // Only the new root is passed; addNodesToRegistry walks the subtree via updatedNodes.
    const updatedRegistry = addNodesToRegistry(ancestorRegistry, [rootId], this.stepId, updatedNodes);

    this.snapshot = {
      insertedNodeIds: ids,
      insertedRootId: rootId,
      parentId: this.stepId,
      position: insertAt,
    };
    this.touchedNodeIds = new Set(ids);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: updatedRegistry,
      activeNodeId: rootId,
    });
    this.triggerAutosave?.();
  }

  undo(): void {
    if (!this.snapshot) return;
    const { nodes, ancestorRegistry } = this.getState();
    const parent = nodes[this.snapshot.parentId];
    if (!parent) return;

    const updatedNodes = { ...nodes };
    for (const id of this.snapshot.insertedNodeIds) {
      delete updatedNodes[id];
    }
    updatedNodes[this.snapshot.parentId] = {
      ...parent,
      children: parent.children.filter((id) => id !== this.snapshot!.insertedRootId),
    };

    // removeNodeFromRegistry walks children recursively, so removing the root is sufficient.
    const updatedRegistry = removeNodeFromRegistry(ancestorRegistry, this.snapshot.insertedRootId, nodes);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: updatedRegistry,
      activeNodeId: this.snapshot.parentId,
    });
    this.triggerAutosave?.();
  }
}
