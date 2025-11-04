import { useState, useEffect } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode, NodeContext, PluginContextMenuItem } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { usePluginStore } from '../../../store/plugins/pluginStore';
import { PluginCommandRegistry } from '../../../../../plugins/core/PluginCommandRegistry';

export function useNodeContextMenu(node: TreeNode) {
  const deleteNode = useStore((state) => state.actions.deleteNode);
  const nodes = useStore((state) => state.nodes);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pluginMenuItems, setPluginMenuItems] = useState<ContextMenuItem[]>([]);

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

  function convertToContextMenuItem(
    item: PluginContextMenuItem,
    node: TreeNode
  ): ContextMenuItem {
    return {
      label: item.label,
      onClick: () => {
        PluginCommandRegistry.execute(item.id, { node });
      },
      disabled: item.disabled,
      danger: false,
    };
  }

  useEffect(() => {
    const hasAncestorSession = hasAncestorWithSession();

    const nodeContext: NodeContext = {
      hasAncestorSession,
    };

    async function loadPluginMenuItems() {
      const items = await Promise.all(
        enabledPlugins.map(async (plugin) => {
          const result = await plugin.extensions.provideNodeContextMenuItems?.(
            node,
            nodeContext
          );
          return result || [];
        })
      );

      const flatItems = items.flat();
      const converted = flatItems.map((item) => convertToContextMenuItem(item, node));
      setPluginMenuItems(converted);
    }

    loadPluginMenuItems();
  }, [node, enabledPlugins, nodes, ancestorRegistry]);

  const baseMenuItems: ContextMenuItem[] = [
    {
      label: 'Delete',
      onClick: handleDelete,
      danger: true,
    },
  ];

  const contextMenuItems = [...pluginMenuItems, ...baseMenuItems];

  return {
    contextMenu,
    contextMenuItems,
    handleContextMenu,
    handleDelete,
    closeContextMenu: () => setContextMenu(null),
  };
}
