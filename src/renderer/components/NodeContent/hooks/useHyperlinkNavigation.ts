import { useCallback } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { useToastStore } from '../../../store/toast/toastStore';
import { useFilesStore } from '../../../store/files/filesStore';

export function useHyperlinkNavigation(node: TreeNode) {
  const store = useActiveTreeStore();
  const activeFile = useFilesStore((state) => state.getActiveFile());
  const setActiveFile = useFilesStore((state) => state.setActiveFile);

  const navigateToLinkedNode = useCallback(() => {
    const linkedNodeId = node.metadata.linkedNodeId as string | undefined;
    if (!linkedNodeId) return;

    const { nodes, actions, blueprintModeEnabled } = store.getState();
    const targetNode = nodes[linkedNodeId];

    if (!targetNode) {
      useToastStore.getState().addToast('Linked node not found', 'error');
      return;
    }

    // If we're in a zoom tab, switch to the main panel first
    if (activeFile?.zoomSource) {
      setActiveFile(activeFile.zoomSource.sourceFilePath);
    }

    // If blueprint mode is on and target is not a blueprint, exit blueprint mode
    if (blueprintModeEnabled && targetNode.metadata.isBlueprint !== true) {
      actions.toggleBlueprintMode();
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
  }, [node.metadata.linkedNodeId, store, activeFile, setActiveFile]);

  return { navigateToLinkedNode };
}
