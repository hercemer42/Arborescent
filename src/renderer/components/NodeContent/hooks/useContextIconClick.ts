import { useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useIconPickerStore } from '../../../store/iconPicker/iconPickerStore';
import { TreeNode } from '../../../../shared/types';

export function useContextIconClick(nodeId: string, node: TreeNode | undefined) {
  const setContextIcon = useStore((state) => state.actions.setContextIcon);
  const openIconPicker = useIconPickerStore((state) => state.open);

  const handleContextIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIcon = (node?.metadata.contextIcon as string) || 'lightbulb';
    const currentColor = node?.metadata.contextColor as string | undefined;
    openIconPicker(currentIcon, (selection) => {
      setContextIcon(nodeId, selection.icon, selection.color);
    }, currentColor);
  }, [nodeId, node?.metadata.contextIcon, node?.metadata.contextColor, openIconPicker, setContextIcon]);

  return handleContextIconClick;
}
