import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { useNodeEditing } from './useNodeEditing';
import { useNodeCursor } from './useNodeCursor';
import { useNodeContextMenu } from './useNodeContextMenu';
import { useNodeKeyboard } from './useNodeKeyboard';

export function useNodeContent(node: TreeNode) {
  const isSelected = useStore((state) => state.selectedNodeId === node.id);
  const updateStatus = useStore((state) => state.actions.updateStatus);

  const hasChildren = node.children.length > 0;

  const { contentRef, handleInput } = useNodeEditing(node);

  useNodeCursor(node, contentRef);

  const { contextMenu, contextMenuItems, handleContextMenu, handleDelete, closeContextMenu } =
    useNodeContextMenu(node);

  const { handleKeyDown } = useNodeKeyboard({
    node,
    contentRef,
    handleDelete,
  });

  return {
    hasChildren,
    isSelected,
    updateStatus,
    contentRef,
    handleKeyDown,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  };
}
