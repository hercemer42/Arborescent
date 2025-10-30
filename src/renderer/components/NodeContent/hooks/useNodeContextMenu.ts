import { useState } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { usePlugins } from '../../../plugins/core';

export function useNodeContextMenu(node: TreeNode) {
  const deleteNode = useStore((state) => state.actions.deleteNode);
  const nodes = useStore((state) => state.nodes);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const { enabledPlugins } = usePlugins();
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

  function hasAncestorWithSession(): boolean {
    const ancestors = ancestorRegistry[node.id] || [];
    return ancestors.some((ancestorId) => {
      const ancestor = nodes[ancestorId];
      return ancestor && ancestor.metadata.plugins?.claude?.sessionId;
    });
  }

  const baseMenuItems: ContextMenuItem[] = [
    {
      label: 'Delete',
      onClick: handleDelete,
      danger: true,
    },
  ];

  const hasAncestorSession = hasAncestorWithSession();

  const pluginMenuItems = enabledPlugins.flatMap((plugin) =>
    plugin.getContextMenuItems(node, hasAncestorSession)
  );

  const contextMenuItems = [...pluginMenuItems, ...baseMenuItems];

  return {
    contextMenu,
    contextMenuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu: () => setContextMenu(null),
  };
}
