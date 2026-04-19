import { TreeNode } from '../../shared/types';
import { AncestorRegistry } from './ancestry';
import { DEFAULT_BLUEPRINT_ICON } from '../store/tree/actions/blueprintActions';

export interface BlueprintVisuals {
  icon: string;
  color?: string;
}

export function getEffectiveBlueprintIcon(
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): BlueprintVisuals {
  if (node.metadata.blueprintIcon) {
    return {
      icon: node.metadata.blueprintIcon as string,
      color: node.metadata.blueprintColor as string | undefined,
    };
  }

  const ancestors = ancestorRegistry[node.id] || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.blueprintIcon) {
      return {
        icon: ancestor.metadata.blueprintIcon as string,
        color: ancestor.metadata.blueprintColor as string | undefined,
      };
    }
  }

  return { icon: DEFAULT_BLUEPRINT_ICON };
}
