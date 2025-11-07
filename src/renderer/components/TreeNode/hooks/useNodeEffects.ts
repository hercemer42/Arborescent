import { useEffect, useRef } from 'react';
import { useStore } from '../../../store/tree/useStore';

interface NodeEffectsResult {
  flashIntensity: 'light' | 'medium' | null;
  nodeRef: React.RefObject<HTMLDivElement | null>;
}

export function useNodeEffects(nodeId: string): NodeEffectsResult {
  const flashingNode = useStore((state) => state.flashingNode);
  const shouldScrollTo = useStore((state) => state.scrollToNodeId === nodeId);
  const nodeRef = useRef<HTMLDivElement>(null);

  const flashIntensity = flashingNode?.nodeId === nodeId ? flashingNode.intensity : null;

  useEffect(() => {
    if (shouldScrollTo && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [shouldScrollTo]);

  return {
    flashIntensity,
    nodeRef,
  };
}
