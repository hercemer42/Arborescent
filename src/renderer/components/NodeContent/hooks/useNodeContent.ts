import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { useNodeEditing } from './useNodeEditing';
import { useNodeCursor } from './useNodeCursor';
import { useNodeContextMenu } from './useNodeContextMenu';
import { useNodeKeyboard } from './useNodeKeyboard';

export function useNodeContent(node: TreeNode) {
  const isSelected = useStore((state) => state.selectedNodeId === node.id);
  const toggleStatus = useStore((state) => state.actions.toggleStatus);

  const hasChildren = node.children.length > 0;

  const { contentRef, handleInput } = useNodeEditing(node);

  useNodeCursor(node, contentRef);

  const { contextMenu, contextMenuItems, handleContextMenu, handleDelete, closeContextMenu } =
    useNodeContextMenu(node);

  const { handleKeyDown, handleMouseDown } = useNodeKeyboard({
    node,
    contentRef,
    handleDelete,
  });

  return {
    hasChildren,
    isSelected,
    toggleStatus,
    contentRef,
    handleKeyDown,
    handleMouseDown,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  };
}
