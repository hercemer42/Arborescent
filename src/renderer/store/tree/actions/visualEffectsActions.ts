export interface VisualEffectsActions {
  flashNode: (nodeId: string, intensity?: 'light' | 'medium') => void;
  scrollToNode: (nodeId: string) => void;
  startDeleteAnimation: (nodeId: string, onComplete?: () => void) => void;
  clearDeleteAnimation: () => void;
}

type StoreState = {
  flashingNode: { nodeId: string; intensity: 'light' | 'medium' } | null;
  scrollToNodeId: string | null;
  deletingNodeId: string | null;
  deleteAnimationCallback: (() => void) | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

export const createVisualEffectsActions = (
  get: () => StoreState,
  set: StoreSetter
): VisualEffectsActions => {
  function flashNode(nodeId: string, intensity: 'light' | 'medium' = 'light'): void {
    set({ flashingNode: { nodeId, intensity } });
    setTimeout(() => {
      set({ flashingNode: null });
    }, 500);
  }

  function scrollToNode(nodeId: string): void {
    set({ scrollToNodeId: nodeId });
    // Clear after a short delay to allow the scroll effect to trigger
    setTimeout(() => {
      set({ scrollToNodeId: null });
    }, 100);
  }

  function startDeleteAnimation(nodeId: string, onComplete?: () => void): void {
    set({ deletingNodeId: nodeId, deleteAnimationCallback: onComplete ?? null });
  }

  function clearDeleteAnimation(): void {
    const { deleteAnimationCallback } = get();
    set({ deletingNodeId: null, deleteAnimationCallback: null });
    // Execute callback after clearing state to ensure deletion happens after animation
    if (deleteAnimationCallback) {
      deleteAnimationCallback();
    }
  }

  return {
    flashNode,
    scrollToNode,
    startDeleteAnimation,
    clearDeleteAnimation,
  };
};
