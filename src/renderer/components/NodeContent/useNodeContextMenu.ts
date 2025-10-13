import { useState, useMemo } from 'react';
import { useStore } from '../../store/tree/useStore';
import { TreeNode } from '../../../shared/types';
import { ContextMenuItem } from '../ui/ContextMenu';

export function useNodeContextMenu(node: TreeNode) {
  const deleteNode = useStore((state) => state.actions.deleteNode);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = () => {
    const deleted = deleteNode(node.id);
    if (!deleted) {
      const confirmed = window.confirm(
        'This node has children. Deleting it will also delete all its children. Are you sure?'
      );
      if (confirmed) {
        deleteNode(node.id, true);
      }
    }
  };

  const contextMenuItems: ContextMenuItem[] = useMemo(
    () => [
      {
        label: 'Delete',
        onClick: handleDelete,
        danger: true,
      },
    ],
    [handleDelete]
  );

  return {
    contextMenu,
    contextMenuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu: () => setContextMenu(null),
  };
}
