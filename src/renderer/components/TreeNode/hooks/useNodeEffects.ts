import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';

interface NodeEffectsResult {
  flashIntensity: 'light' | 'medium' | null;
  isDeleting: boolean;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  onAnimationEnd: (e: React.AnimationEvent) => void;
}

export function useNodeEffects(nodeId: string): NodeEffectsResult {
  const flashingNode = useStore((state) => state.flashingNode);
  const deletingNodeIds = useStore((state) => state.deletingNodeIds);
  const shouldScrollTo = useStore((state) => state.scrollToNodeId === nodeId);
  const clearDeleteAnimation = useStore((state) => state.actions.clearDeleteAnimation);
  const nodeRef = useRef<HTMLDivElement>(null);

  const flashIntensity = flashingNode?.nodeId === nodeId ? flashingNode.intensity : null;
  const isDeleting = deletingNodeIds.has(nodeId);

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
