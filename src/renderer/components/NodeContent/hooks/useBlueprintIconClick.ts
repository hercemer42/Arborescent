import { useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useIconPickerStore } from '../../../store/iconPicker/iconPickerStore';
import { TreeNode } from '../../../../shared/types';
import { DEFAULT_BLUEPRINT_ICON } from '../../../store/tree/actions/blueprintActions';

export function useBlueprintIconClick(nodeId: string, node: TreeNode | undefined) {
  const setBlueprintIcon = useStore((state) => state.actions.setBlueprintIcon);
  const openIconPicker = useIconPickerStore((state) => state.open);

  const handleBlueprintIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIcon = (node?.metadata.blueprintIcon as string) || DEFAULT_BLUEPRINT_ICON;
    const currentColor = node?.metadata.blueprintColor as string | undefined;
    openIconPicker(currentIcon, (selection) => {
      setBlueprintIcon(nodeId, selection.icon, selection.color);
    }, currentColor);
  }, [nodeId, node?.metadata.blueprintIcon, node?.metadata.blueprintColor, openIconPicker, setBlueprintIcon]);

  return handleBlueprintIconClick;
}
