import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { useNodeEditing } from './useNodeEditing';
import { useNodeCursor } from './useNodeCursor';
import { useNodeContextMenu } from './useNodeContextMenu';
import { useNodeKeyboard } from './useNodeKeyboard';

export function useNodeContent(node: TreeNode) {
  const nodeTypeConfig = useStore((state) => state.nodeTypeConfig);
  const isSelected = useStore((state) => state.selectedNodeId === node.id);
  const updateStatus = useStore((state) => state.actions.updateStatus);

  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
  const hasChildren = node.children.length > 0;

  const { contentRef, handleInput } = useNodeEditing(node);

  const { rememberedVisualX, setCursorPosition, setRememberedVisualX } =
    useNodeCursor(node, contentRef);

  const { contextMenu, contextMenuItems, handleContextMenu, handleDelete, closeContextMenu } =
    useNodeContextMenu(node);

  const { handleKeyDown } = useNodeKeyboard({
    node,
    contentRef,
    rememberedVisualX,
    setCursorPosition,
    setRememberedVisualX,
    handleDelete,
  });

  return {
    config,
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
