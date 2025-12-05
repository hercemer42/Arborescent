import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';

interface NodeEffectsResult {
  flashIntensity: 'light' | 'medium' | null;
  isDeleting: boolean;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  onAnimationEnd: (e: React.AnimationEvent) => void;
}

export function useNodeEffects(nodeId: string): NodeEffectsResult {
  const isFlashing = useStore((state) => state.flashingNodeIds.has(nodeId));
  const flashingIntensity = useStore((state) => state.flashingIntensity);
  const isDeleting = useStore((state) => state.deletingNodeIds.has(nodeId));
  const shouldScrollTo = useStore((state) => state.scrollToNodeId === nodeId);
  const clearDeleteAnimation = useStore((state) => state.actions.clearDeleteAnimation);
  const nodeRef = useRef<HTMLDivElement>(null);

  const flashIntensity = isFlashing ? flashingIntensity : null;

  useEffect(() => {
    if (shouldScrollTo && nodeRef.current) {
      nodeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [shouldScrollTo]);

  const onAnimationEnd = useCallback((e: React.AnimationEvent) => {
    // Only handle the delete animation
    if (isDeleting && e.animationName === 'delete-flash') {
      clearDeleteAnimation(nodeId);
    }
  }, [isDeleting, clearDeleteAnimation, nodeId]);

  return {
    flashIntensity,
    isDeleting,
    nodeRef,
    onAnimationEnd,
  };
}
