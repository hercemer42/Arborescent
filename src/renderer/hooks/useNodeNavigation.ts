import { useCallback, useContext } from 'react';
import { TreeStoreContext } from '../store/tree/TreeStoreContext';
import { useFilesStore } from '../store/files/filesStore';

export function useNodeNavigation() {
  const store = useContext(TreeStoreContext);
  const activeFile = useFilesStore((state) => state.getActiveFile());
  const setActiveFile = useFilesStore((state) => state.setActiveFile);

  const navigateToNode = useCallback(
    (nodeId: string) => {
      if (!store) return;

      const { nodes, actions, ancestorRegistry, blueprintModeEnabled } = store.getState();
      const targetNode = nodes[nodeId];
      if (!targetNode) return;

      if (activeFile?.zoomSource) {
        setActiveFile(activeFile.zoomSource.sourceFilePath);
      }

      if (blueprintModeEnabled && targetNode.metadata.isBlueprint !== true) {
        actions.toggleBlueprintMode();
      }

      const ancestors = ancestorRegistry[nodeId] || [];
      for (const ancestorId of ancestors) {
        const ancestor = nodes[ancestorId];
        if (ancestor && ancestor.metadata.expanded === false) {
          actions.toggleNode(ancestorId);
        }
      }

      actions.selectNode(nodeId, 0);
      store.setState({ scrollToNodeId: nodeId });
      actions.flashNode(nodeId, 'light');
    },
    [store, activeFile, setActiveFile]
  );

  return { navigateToNode };
}
