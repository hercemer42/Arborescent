export interface VisualEffectsActions {
  flashNode: (nodeId: string | string[], intensity?: 'light' | 'medium') => void;
  scrollToNode: (nodeId: string) => void;
  startDeleteAnimation: (nodeId: string | string[], onComplete?: () => void) => void;
  clearDeleteAnimation: (nodeId: string) => void;
}

type StoreState = {
  flashingNodeIds: Set<string>;
  flashingIntensity: 'light' | 'medium';
  scrollToNodeId: string | null;
  deletingNodeIds: Set<string>;
  deleteAnimationCallback: (() => void) | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

export const createVisualEffectsActions = (
  get: () => StoreState,
  set: StoreSetter
): VisualEffectsActions => {
  function flashNode(nodeId: string | string[], intensity: 'light' | 'medium' = 'light'): void {
    const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId];
    set({ flashingNodeIds: new Set(nodeIds), flashingIntensity: intensity });
    setTimeout(() => {
      set({ flashingNodeIds: new Set() });
    }, 500);
  }

  function scrollToNode(nodeId: string): void {
    set({ scrollToNodeId: nodeId });
    // Clear after a short delay to allow the scroll effect to trigger
    setTimeout(() => {
      set({ scrollToNodeId: null });
    }, 100);
  }

  function startDeleteAnimation(nodeId: string | string[], onComplete?: () => void): void {
    const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId];
    set({
      deletingNodeIds: new Set(nodeIds),
      deleteAnimationCallback: onComplete ?? null,
    });
  }

  function clearDeleteAnimation(nodeId: string): void {
    const { deletingNodeIds, deleteAnimationCallback } = get();

    // Remove the completed node from the set
    const updatedSet = new Set(deletingNodeIds);
    updatedSet.delete(nodeId);

    if (updatedSet.size === 0) {
      // All animations complete - clear state and execute callback
      set({ deletingNodeIds: new Set(), deleteAnimationCallback: null });
      if (deleteAnimationCallback) {
        deleteAnimationCallback();
      }
    } else {
      // Still waiting for more animations
      set({ deletingNodeIds: updatedSet });
    }
  }

  return {
    flashNode,
    scrollToNode,
    startDeleteAnimation,
    clearDeleteAnimation,
  };
};
