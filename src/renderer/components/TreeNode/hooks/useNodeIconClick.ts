import { useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useIconPickerStore } from '../../../store/iconPicker/iconPickerStore';
import { TreeNode } from '../../../../shared/types';

export function useNodeIconClick(nodeId: string, node: TreeNode | undefined) {
  const setBlueprintIcon = useStore((state) => state.actions.setBlueprintIcon);
  const openIconPicker = useIconPickerStore((state) => state.open);

  const handleIconClick = useCallback(() => {
    const currentIcon = (node?.metadata.blueprintIcon as string) || 'lightbulb';
    const currentColor = node?.metadata.blueprintColor as string | undefined;
    openIconPicker(currentIcon, (selection) => {
      setBlueprintIcon(nodeId, selection.icon, selection.color);
    }, currentColor);
  }, [node?.metadata.blueprintIcon, node?.metadata.blueprintColor, nodeId, openIconPicker, setBlueprintIcon]);

  return handleIconClick;
}
