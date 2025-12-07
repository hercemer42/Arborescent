import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getIconByName, LucideIcon } from '../../ui/IconPicker/IconPicker';
import { getInheritedBlueprintIcon } from '../../../utils/nodeHelpers';
import { DEFAULT_BLUEPRINT_ICON } from '../../../store/tree/actions/blueprintActions';

interface BlueprintIconResult {
  BlueprintIcon: LucideIcon;
  blueprintColor: string | undefined;
  isInherited: boolean;
}

export function useBlueprintIcon(node: TreeNode): BlueprintIconResult {
  const hasOwnBlueprintIcon = !!node.metadata.blueprintIcon;

  const inheritedBlueprintData = useStore((state) => {
    if (hasOwnBlueprintIcon || !node.metadata.isBlueprint) return null;
    const result = getInheritedBlueprintIcon(node.id, state.nodes, state.ancestorRegistry);
    if (!result) return null;
    return `${result.icon}:${result.color ?? ''}`;
  });

  const inheritedBlueprint = useMemo(() => {
    if (!inheritedBlueprintData) return undefined;
    const [icon, color] = inheritedBlueprintData.split(':');
    return { icon, color: color || undefined };
  }, [inheritedBlueprintData]);

  const blueprintIconName = hasOwnBlueprintIcon
    ? (node.metadata.blueprintIcon as string)
    : inheritedBlueprint?.icon || DEFAULT_BLUEPRINT_ICON;

  const blueprintColor = hasOwnBlueprintIcon
    ? node.metadata.blueprintColor as string | undefined
    : inheritedBlueprint?.color;

  const BlueprintIcon = getIconByName(blueprintIconName) || Boxes;

  return {
    BlueprintIcon,
    blueprintColor,
    isInherited: !hasOwnBlueprintIcon,
  };
}
