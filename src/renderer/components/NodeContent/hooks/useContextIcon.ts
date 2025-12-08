import { useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getIconByName, LucideIcon } from '../../ui/IconPicker/IconPicker';

interface ContextIconResult {
  isContextDeclaration: boolean;
  isContextChild: boolean;
  ContextIcon: LucideIcon | undefined;
  contextColor: string | undefined;
}

export function useContextIcon(node: TreeNode): ContextIconResult {
  const isContextDeclaration = node.metadata.isContextDeclaration === true;
  const nodeId = node.id;

  // Get ancestor IDs - stable unless tree structure changes
  const ancestors = useStore((state) => state.ancestorRegistry[nodeId]);

  // Get context declaration ancestor data - only traverse if not a declaration itself
  const contextAncestorData = useStore((state) => {
    if (isContextDeclaration) return null;
    if (!ancestors || ancestors.length === 0) return null;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = state.nodes[ancestors[i]];
      if (ancestor?.metadata.isContextDeclaration) {
        return `${ancestor.metadata.blueprintIcon ?? ''}:${ancestor.metadata.blueprintColor ?? ''}`;
      }
    }
    return null;
  });

  return useMemo(() => {
    // Context declaration - use node's own icon/color
    if (isContextDeclaration) {
      const contextIcon = node.metadata.blueprintIcon as string | undefined;
      const contextColor = node.metadata.blueprintColor as string | undefined;
      const ContextIcon = contextIcon ? getIconByName(contextIcon) ?? undefined : undefined;
      return { isContextDeclaration: true, isContextChild: false, ContextIcon, contextColor };
    }

    // Not a context child
    if (!contextAncestorData) {
      return { isContextDeclaration: false, isContextChild: false, ContextIcon: undefined, contextColor: undefined };
    }

    // Context child - use inherited icon/color
    const [icon, color] = contextAncestorData.split(':');
    const ContextIcon = icon ? getIconByName(icon) ?? undefined : undefined;
    return {
      isContextDeclaration: false,
      isContextChild: true,
      ContextIcon,
      contextColor: color || undefined,
    };
  }, [isContextDeclaration, node.metadata.blueprintIcon, node.metadata.blueprintColor, contextAncestorData]);
}
