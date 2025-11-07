import { useStore } from '../../../store/tree/useStore';

interface NodeEffectsResult {
  isFlashing: boolean;
}

export function useNodeEffects(nodeId: string): NodeEffectsResult {
  const isFlashing = useStore((state) => state.flashingNodeId === nodeId);

  return {
    isFlashing,
  };
}
