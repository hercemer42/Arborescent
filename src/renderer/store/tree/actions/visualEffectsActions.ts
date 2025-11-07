export interface VisualEffectsActions {
  flashNode: (nodeId: string) => void;
}

type StoreState = {
  flashingNodeId: string | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

export const createVisualEffectsActions = (
  get: () => StoreState,
  set: StoreSetter
): VisualEffectsActions => {
  function flashNode(nodeId: string): void {
    set({ flashingNodeId: nodeId });
    setTimeout(() => {
      set({ flashingNodeId: null });
    }, 500);
  }

  return {
    flashNode,
  };
};
