import { useCallback } from 'react';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { isDescendant as checkIsDescendant } from '../../../services/ancestry';

export function useNodeToggle(nodeId: string, expanded: boolean, contentLength: number) {
  const store = useActiveTreeStore();

  const handleToggle = useCallback(() => {
    const newExpandedState = !expanded;

    if (!newExpandedState) {
      const { activeNodeId, ancestorRegistry, actions } = store.getState();
      if (checkIsDescendant(nodeId, activeNodeId, ancestorRegistry)) {
        actions.selectNode(nodeId, contentLength);
      }
    }

    store.getState().actions.toggleNode(nodeId);
  }, [expanded, nodeId, contentLength, store]);

  return handleToggle;
}
