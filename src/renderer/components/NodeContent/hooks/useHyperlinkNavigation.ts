import { useCallback } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { useToastStore } from '../../../store/toast/toastStore';

export function useHyperlinkNavigation(node: TreeNode) {
  const store = useActiveTreeStore();

  const navigateToLinkedNode = useCallback(() => {
    const linkedNodeId = node.metadata.linkedNodeId as string | undefined;
    if (!linkedNodeId) return;

    const { nodes, actions } = store.getState();
    const targetNode = nodes[linkedNodeId];

    if (!targetNode) {
      useToastStore.getState().addToast('Linked node not found', 'error');
      return;
    }

    // Expand all collapsed ancestors of the target node
    const { ancestorRegistry } = store.getState();
    const ancestors = ancestorRegistry[linkedNodeId] || [];

    for (const ancestorId of ancestors) {
      const ancestor = nodes[ancestorId];
      if (ancestor && ancestor.metadata.expanded === false) {
        actions.toggleNode(ancestorId);
      }
    }

    // Select the target node and scroll to it
    actions.selectNode(linkedNodeId, 0);
    store.setState({ scrollToNodeId: linkedNodeId });
  }, [node.metadata.linkedNodeId, store]);

  return { navigateToLinkedNode };
}
