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

export function useEditMenuState(): EditMenuState {
  const treeState = useActiveTreeStore();

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

  const isCollaborating = collaboratingNodeId !== null;
  const hasNodeSelected = activeNodeId !== null || multiSelectedNodeIds.size > 0;

  const canCut = hasNodeSelected && !isCollaborating;
  const canCopy = hasNodeSelected;
  const canDelete = hasNodeSelected && !isCollaborating;
  const canPaste = !isCollaborating;
  const canToggleStatus = activeNodeId !== null && !isCollaborating;
  const canIndent = activeNodeId !== null && !isCollaborating;
  const canOutdent = activeNodeId !== null && !isCollaborating;
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
