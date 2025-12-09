import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { useNodeEditing } from './useNodeEditing';
import { useNodeCursor } from './useNodeCursor';
import { useNodeContextMenu } from './useNodeContextMenu';

export function useNodeContent(node: TreeNode) {
  const isSelected = useStore((state) => state.activeNodeId === node.id);
  const toggleStatus = useStore((state) => state.actions.toggleStatus);

  const hasChildren = node.children.length > 0;

  const { contentRef, setContentRef, handleInput } = useNodeEditing(node);

  useNodeCursor(node, contentRef);

  const {
    contextMenu,
    contextMenuItems,
    handleContextMenu,
    closeContextMenu,
  } = useNodeContextMenu(node);

  return {
    hasChildren,
    isSelected,
    toggleStatus,
    contentRef,
    setContentRef,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  };
}
