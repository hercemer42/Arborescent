import { useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { useCustomizeDialogStore } from '../../../store/customizeDialog/customizeDialogStore';
import { TreeNode } from '../../../../shared/types';

export function useContextIconClick(nodeId: string, node: TreeNode | undefined) {
  const declareAsContextWithFlags = useStore((state) => state.actions.declareAsContextWithFlags);
  const openCustomizeDialog = useCustomizeDialogStore((state) => state.open);

  const handleContextIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIcon = (node?.metadata.blueprintIcon as string) || 'lightbulb';
    const currentColor = node?.metadata.blueprintColor as string | undefined;
    const currentCollaborate = node?.metadata.collaborate === true;
    const currentExecute = node?.metadata.execute === true;
    openCustomizeDialog(
      currentIcon,
      (selection) => {
        declareAsContextWithFlags(nodeId, selection.icon, selection.color, {
          collaborate: selection.collaborate === true,
          execute: selection.execute === true,
        });
      },
      currentColor,
      {
        showFlagsPicker: true,
        selectedCollaborate: currentCollaborate,
        selectedExecute: currentExecute,
      },
    );
  }, [nodeId, node?.metadata.blueprintIcon, node?.metadata.blueprintColor, node?.metadata.collaborate, node?.metadata.execute, openCustomizeDialog, declareAsContextWithFlags]);

  return handleContextIconClick;
}
