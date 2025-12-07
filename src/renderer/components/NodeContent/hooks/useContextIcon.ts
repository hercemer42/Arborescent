import { useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getIconByName, LucideIcon } from '../../ui/IconPicker/IconPicker';
import { getInheritedBlueprintIcon, getIsContextChild } from '../../../utils/nodeHelpers';

interface ContextIconResult {
  isContextDeclaration: boolean;
  isContextChild: boolean;
  ContextIcon: LucideIcon | undefined;
  contextColor: string | undefined;
}

export function useContextIcon(node: TreeNode): ContextIconResult {
  const isContextDeclaration = node.metadata.isContextDeclaration === true;

  const contextData = useStore((state) => {
    if (isContextDeclaration) return 'declaration';
    const isChild = getIsContextChild(node.id, state.nodes, state.ancestorRegistry);
    if (!isChild) return null;
    const inherited = getInheritedBlueprintIcon(node.id, state.nodes, state.ancestorRegistry);
    if (!inherited) return 'child:';
    return `child:${inherited.icon}:${inherited.color ?? ''}`;
  });

  const { isContextChild, inheritedIcon } = useMemo(() => {
    if (!contextData || contextData === 'declaration') {
      return { isContextChild: false, inheritedIcon: undefined };
    }
    const parts = contextData.split(':');
    if (parts[0] === 'child') {
      const icon = parts[1] || undefined;
      const color = parts[2] || undefined;
      return {
        isContextChild: true,
        inheritedIcon: icon ? { icon, color } : undefined,
      };
    }
    return { isContextChild: false, inheritedIcon: undefined };
  }, [contextData]);

  const contextIcon = isContextDeclaration
    ? node.metadata.blueprintIcon as string | undefined
    : inheritedIcon?.icon;
  const contextColor = isContextDeclaration
    ? node.metadata.blueprintColor as string | undefined
    : inheritedIcon?.color;
  const ContextIcon = contextIcon ? getIconByName(contextIcon) ?? undefined : undefined;

  return {
    isContextDeclaration,
    isContextChild,
    ContextIcon,
    contextColor,
  };
}
