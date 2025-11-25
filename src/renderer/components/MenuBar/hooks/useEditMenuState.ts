import { useActiveTreeStore } from './useActiveTreeStore';

interface EditMenuState {
  canUndo: boolean;
  canRedo: boolean;
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDelete: boolean;
}

/**
 * Hook to derive enabled/disabled states for Edit menu items.
 * Subscribes to relevant store state and returns boolean flags.
 */
export function useEditMenuState(): EditMenuState {
  const treeState = useActiveTreeStore();

  // No active file - disable everything
  if (!treeState) {
    return {
      canUndo: false,
      canRedo: false,
      canCut: false,
      canCopy: false,
      canPaste: false,
      canDelete: false,
    };
  }

  const { actions, activeNodeId, multiSelectedNodeIds, collaboratingNodeId } = treeState;

  const canUndo = actions.canUndo();
  const canRedo = actions.canRedo();

  // Can't perform edit operations while collaborating
  const isCollaborating = collaboratingNodeId !== null;

  // Has a node selected (either active or multi-selected)
  const hasNodeSelected = activeNodeId !== null || multiSelectedNodeIds.size > 0;

  // Cut/Copy/Delete require a node to be selected and not in collaboration mode
  const canCut = hasNodeSelected && !isCollaborating;
  const canCopy = hasNodeSelected;
  const canDelete = hasNodeSelected && !isCollaborating;

  // Paste is always enabled (we'll check clipboard content when executed)
  // The actual paste logic will determine if it's valid markdown or should fall through
  const canPaste = !isCollaborating;

  return {
    canUndo,
    canRedo,
    canCut,
    canCopy,
    canPaste,
    canDelete,
  };
}
