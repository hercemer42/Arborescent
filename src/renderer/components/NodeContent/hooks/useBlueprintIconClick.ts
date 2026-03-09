import { useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useCustomizeDialogStore } from '../../../store/customizeDialog/customizeDialogStore';
import { TreeNode } from '../../../../shared/types';
import { DEFAULT_BLUEPRINT_ICON } from '../../../store/tree/actions/blueprintActions';

export function useBlueprintIconClick(nodeId: string, node: TreeNode | undefined) {
  const setBlueprintIcon = useStore((state) => state.actions.setBlueprintIcon);
  const openCustomizeDialog = useCustomizeDialogStore((state) => state.open);

  const handleBlueprintIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIcon = (node?.metadata.blueprintIcon as string) || DEFAULT_BLUEPRINT_ICON;
    const currentColor = node?.metadata.blueprintColor as string | undefined;
    openCustomizeDialog(currentIcon, (selection) => {
      setBlueprintIcon(nodeId, selection.icon, selection.color);
    }, currentColor);
  }, [nodeId, node?.metadata.blueprintIcon, node?.metadata.blueprintColor, openCustomizeDialog, setBlueprintIcon]);

  return handleBlueprintIconClick;
}
