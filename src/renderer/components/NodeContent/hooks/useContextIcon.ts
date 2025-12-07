import { useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getIconByName, LucideIcon } from '../../ui/IconPicker/IconPicker';
import { getInheritedContextIcon } from '../../../utils/nodeHelpers';

interface ContextIconResult {
  isContextDeclaration: boolean;
  isContextChild: boolean;
  ContextIcon: LucideIcon | undefined;
  contextColor: string | undefined;
}

export function useContextIcon(node: TreeNode): ContextIconResult {
  const isContextDeclaration = node.metadata.isContextDeclaration === true;
  const isContextChild = node.metadata.isContextChild === true;

  const inheritedContextData = useStore((state) => {
    if (isContextDeclaration || !isContextChild) return null;
    const result = getInheritedContextIcon(node.id, state.nodes, state.ancestorRegistry);
    if (!result) return null;
    return `${result.icon}:${result.color ?? ''}`;
  });

  const inheritedContext = useMemo(() => {
    if (!inheritedContextData) return undefined;
    const [icon, color] = inheritedContextData.split(':');
    return { icon, color: color || undefined };
  }, [inheritedContextData]);

  const contextIcon = isContextDeclaration
    ? node.metadata.contextIcon as string | undefined
    : inheritedContext?.icon;
  const contextColor = isContextDeclaration
    ? node.metadata.contextColor as string | undefined
    : inheritedContext?.color;
  const ContextIcon = contextIcon ? getIconByName(contextIcon) ?? undefined : undefined;

  return {
    isContextDeclaration,
    isContextChild,
    ContextIcon,
    contextColor,
  };
}
