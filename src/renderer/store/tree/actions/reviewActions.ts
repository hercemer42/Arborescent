import { TreeState } from '../treeStore';
import { TreeNode } from '../../../../shared/types';

export interface ReviewActions {
  startReview: (nodeId: string) => void;
  cancelReview: () => void;
  acceptReview: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => void;
}

export function createReviewActions(
  get: () => TreeState,
  set: (partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void
): ReviewActions {
  return {
    /**
     * Start reviewing a node
     * Only one node can be reviewed at a time
     */
    startReview: (nodeId: string) => {
      const state = get();

      // Can't start a new review if one is already in progress
      if (state.reviewingNodeId) {
        return;
      }

      set({ reviewingNodeId: nodeId });
    },

    /**
     * Cancel the current review
     */
    cancelReview: () => {
      set({ reviewingNodeId: null });
    },

    /**
     * Accept review and replace the reviewing node with new nodes
     * @param newRootNodeId - The ID of the new root node to replace the reviewing node
     * @param newNodesMap - Flat map of all new nodes (including the root and all descendants)
     */
    acceptReview: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => {
      const state = get();
      const reviewingNodeId = state.reviewingNodeId;

      if (!reviewingNodeId) {
        return;
      }

      const reviewingNode = state.nodes[reviewingNodeId];
      if (!reviewingNode) {
        return;
      }

      // Find all descendants of the reviewing node
      const descendantIds = new Set<string>();
      const collectDescendants = (nodeId: string) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        for (const childId of node.children) {
          descendantIds.add(childId);
          collectDescendants(childId);
        }
      };
      collectDescendants(reviewingNodeId);

      // Find parent by searching through all nodes
      let parentId: string | null = null;
      for (const [id, node] of Object.entries(state.nodes)) {
        if (node.children.includes(reviewingNodeId)) {
          parentId = id;
          break;
        }
      }

      // Create merged nodes map
      const mergedNodesMap = { ...state.nodes };

      // Remove old reviewing node and its descendants
      delete mergedNodesMap[reviewingNodeId];
      for (const descendantId of descendantIds) {
        delete mergedNodesMap[descendantId];
      }

      // Add all new nodes
      for (const [id, node] of Object.entries(newNodesMap)) {
        mergedNodesMap[id] = node;
      }

      // Update parent's children or root
      let updatedRootNodeId = state.rootNodeId;

      if (parentId !== null) {
        const parent = mergedNodesMap[parentId];
        if (parent) {
          const newChildren = parent.children.map(id =>
            id === reviewingNodeId ? newRootNodeId : id
          );
          mergedNodesMap[parentId] = { ...parent, children: newChildren };
        }
      } else {
        // Replacing the root node itself
        updatedRootNodeId = newRootNodeId;
      }

      // Rebuild ancestor registry
      const newAncestorRegistry: Record<string, string[]> = {};

      const buildAncestorRegistry = (nodeId: string, ancestors: string[]) => {
        newAncestorRegistry[nodeId] = ancestors;

        const node = mergedNodesMap[nodeId];
        if (node) {
          const newAncestors = [...ancestors, nodeId];
          for (const childId of node.children) {
            buildAncestorRegistry(childId, newAncestors);
          }
        }
      };

      buildAncestorRegistry(updatedRootNodeId, []);

      set({
        nodes: mergedNodesMap,
        rootNodeId: updatedRootNodeId,
        ancestorRegistry: newAncestorRegistry,
        reviewingNodeId: null,
      });
    },
  };
}
