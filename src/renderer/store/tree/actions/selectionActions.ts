import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry } from '../../../services/ancestry';
import { getAllDescendants, getVisibleNodesInOrder } from '../../../utils/nodeHelpers';

export interface SelectionActions {
  toggleNodeSelection: (nodeId: string) => void;
  selectRange: (nodeId: string) => void;
  addToSelection: (nodeIds: string[]) => void;
  clearSelection: () => void;
  getNodesToMove: () => string[];
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  multiSelectedNodeIds: Set<string>;
  lastSelectedNodeId: string | null;
  rootNodeId: string;
};

type StoreSetter = (partial: Partial<StoreState>) => void;

/**
 * Create a selection set containing a node and all its descendants
 */
function createSelectionWithDescendants(
  nodeId: string,
  nodes: Record<string, TreeNode>
): Set<string> {
  const selection = new Set<string>();
  selection.add(nodeId);
  const descendants = getAllDescendants(nodeId, nodes);
  descendants.forEach(descId => selection.add(descId));
  return selection;
}


export const createSelectionActions = (
  get: () => StoreState,
  set: StoreSetter
): SelectionActions => {
  function toggleNodeSelection(nodeId: string): void {
    const { multiSelectedNodeIds, nodes, ancestorRegistry } = get();
    const newSelection = new Set(multiSelectedNodeIds);

    if (newSelection.has(nodeId)) {
      // Trying to deselect: check if any ancestor is selected
      const ancestors = ancestorRegistry[nodeId] || [];
      const hasSelectedAncestor = ancestors.some(ancestorId => multiSelectedNodeIds.has(ancestorId));

      if (hasSelectedAncestor) {
        return;
      }

      // Remove this node and all its descendants
      const nodeWithDescendants = createSelectionWithDescendants(nodeId, nodes);
      nodeWithDescendants.forEach(id => newSelection.delete(id));

      // Keep anchor unchanged when deselecting (don't set anchor to a removed node)
      set({ multiSelectedNodeIds: newSelection });
    } else {
      // Adding to selection: add this node and all its descendants
      const nodeWithDescendants = createSelectionWithDescendants(nodeId, nodes);
      nodeWithDescendants.forEach(id => newSelection.add(id));

      // Update anchor so Shift+Click can create range from this node
      set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
    }
  }

  function selectRange(nodeId: string): void {
    const { lastSelectedNodeId, nodes, rootNodeId, ancestorRegistry } = get();

    if (!lastSelectedNodeId) {
      // First Shift+Click: select this node and set as anchor
      const newSelection = createSelectionWithDescendants(nodeId, nodes);
      set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
      return;
    }

    // Get all visible nodes in order
    const visibleNodes = getVisibleNodesInOrder(rootNodeId, nodes, ancestorRegistry);

    // Find indices of the range boundaries
    const startIndex = visibleNodes.indexOf(lastSelectedNodeId);
    const endIndex = visibleNodes.indexOf(nodeId);

    if (startIndex === -1 || endIndex === -1) {
      // One of the nodes not found, just select this node and set as new anchor
      const newSelection = createSelectionWithDescendants(nodeId, nodes);
      set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
      return;
    }

    // Determine the range (could be forward or backward)
    const rangeStart = Math.min(startIndex, endIndex);
    const rangeEnd = Math.max(startIndex, endIndex);

    // Get all nodes in the range
    const rangeNodes = visibleNodes.slice(rangeStart, rangeEnd + 1);

    // Select all nodes in range (and their descendants)
    // Start with existing selection to accumulate ranges (allow chaining)
    const { multiSelectedNodeIds } = get();
    const newSelection = new Set(multiSelectedNodeIds);
    rangeNodes.forEach(id => {
      const nodeSelection = createSelectionWithDescendants(id, nodes);
      nodeSelection.forEach(selectedId => newSelection.add(selectedId));
    });

    // Update anchor to this node, so next Shift+Click extends from here
    set({ multiSelectedNodeIds: newSelection, lastSelectedNodeId: nodeId });
  }

  function addToSelection(nodeIds: string[]): void {
    const { multiSelectedNodeIds, nodes } = get();
    const newSelection = new Set(multiSelectedNodeIds);

    // Add each node and all its descendants
    nodeIds.forEach(id => {
      const nodeWithDescendants = createSelectionWithDescendants(id, nodes);
      nodeWithDescendants.forEach(selectedId => newSelection.add(selectedId));
    });

    set({ multiSelectedNodeIds: newSelection });
  }

  function clearSelection(): void {
    set({ multiSelectedNodeIds: new Set(), lastSelectedNodeId: null });
  }

  /**
   * Get the list of nodes to actually move when dragging.
   * Filters out nodes whose ancestors are also selected (they will move with their ancestors).
   *
   * Example: If A, B (child of A), and C (child of A) are selected,
   * only A should be moved (B and C will follow).
   *
   * Example: If B and C (both children of A) are selected, but not A,
   * both B and C should be moved.
   */
  function getNodesToMove(): string[] {
    const { multiSelectedNodeIds, ancestorRegistry } = get();
    const selectedArray = Array.from(multiSelectedNodeIds);

    return selectedArray.filter((nodeId) => {
      const ancestors = ancestorRegistry[nodeId] || [];

      // Check if any ancestor of this node is also selected
      const hasSelectedAncestor = ancestors.some((ancestorId) =>
        multiSelectedNodeIds.has(ancestorId)
      );

      // Only include this node if none of its ancestors are selected
      return !hasSelectedAncestor;
    });
  }

  return {
    toggleNodeSelection,
    selectRange,
    addToSelection,
    clearSelection,
    getNodesToMove,
  };
};
