import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getIconByName, LucideIcon } from '../../ui/IconPicker/IconPicker';
import { DEFAULT_BLUEPRINT_ICON } from '../../../store/tree/actions/blueprintActions';

interface BlueprintIconResult {
  BlueprintIcon: LucideIcon;
  blueprintColor: string | undefined;
  isInherited: boolean;
}

export function useBlueprintIcon(node: TreeNode): BlueprintIconResult {
  const hasOwnBlueprintIcon = !!node.metadata.blueprintIcon;
  const isBlueprint = node.metadata.isBlueprint === true;
  const nodeId = node.id;

  // Get ancestor IDs - stable unless tree structure changes
  const ancestors = useStore((state) => state.ancestorRegistry[nodeId]);

  // Get inherited blueprint data - only if needed
  const inheritedBlueprintData = useStore((state) => {
    if (hasOwnBlueprintIcon || !isBlueprint) return null;
    if (!ancestors || ancestors.length === 0) return null;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = state.nodes[ancestors[i]];
      if (ancestor?.metadata.blueprintIcon) {
        return `${ancestor.metadata.blueprintIcon}:${ancestor.metadata.blueprintColor ?? ''}`;
      }
    }
    return null;
  });

  return useMemo(() => {
    // Has own icon - use it directly
    if (hasOwnBlueprintIcon) {
      const blueprintIconName = node.metadata.blueprintIcon as string;
      const blueprintColor = node.metadata.blueprintColor as string | undefined;
      return {
        BlueprintIcon: getIconByName(blueprintIconName) || Boxes,
        blueprintColor,
        isInherited: false,
      };
    }

    // Use inherited or default
    if (inheritedBlueprintData) {
      const [icon, color] = inheritedBlueprintData.split(':');
      return {
        BlueprintIcon: getIconByName(icon) || Boxes,
        blueprintColor: color || undefined,
        isInherited: true,
      };
    }

    // Default
    return {
      BlueprintIcon: getIconByName(DEFAULT_BLUEPRINT_ICON) || Boxes,
      blueprintColor: undefined,
      isInherited: true,
    };
  }, [hasOwnBlueprintIcon, node.metadata.blueprintIcon, node.metadata.blueprintColor, inheritedBlueprintData]);
}
