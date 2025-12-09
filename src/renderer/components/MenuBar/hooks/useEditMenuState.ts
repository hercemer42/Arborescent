import { useActiveTreeStore } from './useActiveTreeStore';

interface EditMenuState {
  canUndo: boolean;
  canRedo: boolean;
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDelete: boolean;
  canToggleStatus: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  canSelectAll: boolean;
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
      canToggleStatus: false,
      canIndent: false,
      canOutdent: false,
      canSelectAll: false,
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

  // Toggle status requires active node and not collaborating
  const canToggleStatus = activeNodeId !== null && !isCollaborating;

  // Indent/Outdent require active node and not collaborating
  const canIndent = activeNodeId !== null && !isCollaborating;
  const canOutdent = activeNodeId !== null && !isCollaborating;

  // Select all requires at least one node to exist
  const canSelectAll = Object.keys(treeState.nodes).length > 1;

  return {
    canUndo,
    canRedo,
    canCut,
    canCopy,
    canPaste,
    canDelete,
    canToggleStatus,
    canIndent,
    canOutdent,
    canSelectAll,
  };
}
