import { useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useCustomizeDialogStore } from '../../../store/customizeDialog/customizeDialogStore';
import { TreeNode } from '../../../../shared/types';

export function useContextIconClick(nodeId: string, node: TreeNode | undefined) {
  const declareAsContext = useStore((state) => state.actions.declareAsContext);
  const openCustomizeDialog = useCustomizeDialogStore((state) => state.open);

  const handleContextIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIcon = (node?.metadata.blueprintIcon as string) || 'lightbulb';
    const currentColor = node?.metadata.blueprintColor as string | undefined;
    const currentMode = node?.metadata.execute === true ? 'execute' : 'collaborate';
    openCustomizeDialog(currentIcon, (selection) => {
      declareAsContext(nodeId, selection.icon, selection.color, selection.mode);
    }, currentColor, { showModeToggle: true, selectedMode: currentMode });
  }, [nodeId, node?.metadata.blueprintIcon, node?.metadata.blueprintColor, node?.metadata.execute, openCustomizeDialog, declareAsContext]);

  return handleContextIconClick;
}
