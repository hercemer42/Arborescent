import { TreeNode } from '../../shared/types';
import { AncestorRegistry, findClosestAncestor } from './ancestry';
import { DEFAULT_BLUEPRINT_ICON } from '../store/tree/actions/blueprintActions';

export interface BlueprintVisuals {
  icon: string;
  color?: string;
}

function extractVisuals(node: TreeNode): BlueprintVisuals | undefined {
  if (!node.metadata.blueprintIcon) return undefined;
  return {
    icon: node.metadata.blueprintIcon as string,
    color: node.metadata.blueprintColor as string | undefined,
  };
}

export function getEffectiveBlueprintIcon(
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): BlueprintVisuals {
  const own = extractVisuals(node);
  if (own) return own;

  const inherited = findClosestAncestor(node.id, nodes, ancestorRegistry, extractVisuals);
  return inherited ?? { icon: DEFAULT_BLUEPRINT_ICON };
}
