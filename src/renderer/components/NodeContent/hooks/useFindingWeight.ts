import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getFindingWeight, isFinding } from '../../../utils/findings';

// Null for a node that is not a finding, so one number answers both "does this
// render a weight badge" and "what does it read" — the shape a workflow step's
// number already uses for the same substitution.
export function useFindingWeight(node: TreeNode): number | null {
  return useStore((state) =>
    isFinding(node.id, state.nodes, state.ancestorRegistry) ? getFindingWeight(node.id, state.nodes) : null,
  );
}
