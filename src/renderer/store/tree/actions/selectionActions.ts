import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry } from '../../../services/ancestry';
import { getAllDescendants, getVisibleNodesInOrder } from '../../../utils/nodeHelpers';

export interface SelectionActions {
  toggleNodeSelection: (nodeId: string) => void;
  selectRange: (nodeId: string) => void;
  addToSelection: (nodeIds: string[]) => void;
  clearSelection: () => void;
  getNodesToMove: () => string[];
  selectAllNodes: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  multiSelectedNodeIds: Set<string>;
  lastSelectedNodeId: string | null;
  rootNodeId: string;
  summaryModeEnabled: boolean;
  summaryVisibleNodeIds: Set<string> | null;
};

type StoreSetter = (partial: Partial<StoreState>) => void;

function createSelectionWithDescendants(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  summaryModeEnabled: boolean,
  summaryVisibleNodeIds: Set<string> | null
): Set<string> {
  const selection = new Set<string>();

  if (summaryModeEnabled && summaryVisibleNodeIds && !summaryVisibleNodeIds.has(nodeId)) {
    return selection;
  }

  selection.add(nodeId);
  const descendants = getAllDescendants(nodeId, nodes);
  descendants.forEach(descId => {
    if (summaryModeEnabled && summaryVisibleNodeIds) {
      if (summaryVisibleNodeIds.has(descId)) {
        selection.add(descId);
      }
    } else {
      selection.add(descId);
    }
  });
  return selection;
}


export const createSelectionActions = (
  get: () => StoreState,
  set: StoreSetter
): SelectionActions => {
  function toggleNodeSelection(nodeId: string): void {
    const { multiSelectedNodeIds, nodes, ancestorRegistry, summaryModeEnabled, summaryVisibleNodeIds } = get();
    const newSelection = new Set(multiSelectedNodeIds);

    if (newSelection.has(nodeId)) {
      const ancestors = ancestorRegistry[nodeId] || [];
      const hasSelectedAncestor = ancestors.some(ancestorId => multiSelectedNodeIds.has(ancestorId));

      if (hasSelectedAncestor) {
        return;
      }

      const nodeWithDescendants = createSelectionWithDescendants(nodeId, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      nodeWithDescendants.forEach(id => newSelection.delete(id));

      set({ multiSelectedNodeIds: newSelection });
    } else {
      const nodeWithDescendants = createSelectionWithDescendants(nodeId, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      nodeWithDescendants.forEach(id => newSelection.add(id));

      set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
    }
  }

  function selectRange(nodeId: string): void {
    const { lastSelectedNodeId, nodes, rootNodeId, ancestorRegistry, summaryModeEnabled, summaryVisibleNodeIds } = get();

    if (!lastSelectedNodeId) {
      const newSelection = createSelectionWithDescendants(nodeId, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
      return;
    }

    const visibleNodes = getVisibleNodesInOrder(rootNodeId, nodes, ancestorRegistry);

    const startIndex = visibleNodes.indexOf(lastSelectedNodeId);
    const endIndex = visibleNodes.indexOf(nodeId);

    if (startIndex === -1 || endIndex === -1) {
      const newSelection = createSelectionWithDescendants(nodeId, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
      return;
    }

    const rangeStart = Math.min(startIndex, endIndex);
    const rangeEnd = Math.max(startIndex, endIndex);

    const rangeNodes = visibleNodes.slice(rangeStart, rangeEnd + 1);

    const { multiSelectedNodeIds } = get();
    const newSelection = new Set(multiSelectedNodeIds);
    rangeNodes.forEach(id => {
      const nodeSelection = createSelectionWithDescendants(id, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      nodeSelection.forEach(selectedId => newSelection.add(selectedId));
    });

    set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
  }

  function addToSelection(nodeIds: string[]): void {
    const { multiSelectedNodeIds, nodes, summaryModeEnabled, summaryVisibleNodeIds } = get();
    const newSelection = new Set(multiSelectedNodeIds);

    nodeIds.forEach(id => {
      const nodeWithDescendants = createSelectionWithDescendants(id, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      nodeWithDescendants.forEach(selectedId => newSelection.add(selectedId));
    });

    set({ multiSelectedNodeIds: newSelection });
  }

  function clearSelection(): void {
    set({ multiSelectedNodeIds: new Set(), lastSelectedNodeId: null });
  }

  function getNodesToMove(): string[] {
    const { multiSelectedNodeIds, ancestorRegistry } = get();
    const selectedArray = Array.from(multiSelectedNodeIds);

    return selectedArray.filter((nodeId) => {
      const ancestors = ancestorRegistry[nodeId] || [];

      const hasSelectedAncestor = ancestors.some((ancestorId) =>
        multiSelectedNodeIds.has(ancestorId)
      );

      return !hasSelectedAncestor;
    });
  }

  function selectAllNodes(): void {
    const { nodes, rootNodeId, summaryModeEnabled, summaryVisibleNodeIds } = get();
    const rootNode = nodes[rootNodeId];
    if (!rootNode || rootNode.children.length === 0) return;

    const newSelection = new Set<string>();
    for (const childId of rootNode.children) {
      const nodeSelection = createSelectionWithDescendants(childId, nodes, summaryModeEnabled, summaryVisibleNodeIds);
      nodeSelection.forEach(id => newSelection.add(id));
    }

    set({
      multiSelectedNodeIds: newSelection,
      lastSelectedNodeId: rootNode.children[0],
    });
  }

  return {
    toggleNodeSelection,
    selectRange,
    addToSelection,
    clearSelection,
    getNodesToMove,
    selectAllNodes,
  };
};
