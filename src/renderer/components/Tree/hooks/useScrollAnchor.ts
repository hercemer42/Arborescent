import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';

interface Anchor {
  nodeId: string;
  relativeTop: number;
}

function findTopmostVisibleAnchor(container: HTMLElement): Anchor | null {
  const containerTop = container.getBoundingClientRect().top;
  const nodeEls = Array.from(container.querySelectorAll<HTMLElement>('[data-node-id]'));
  for (const el of nodeEls) {
    const top = el.getBoundingClientRect().top - containerTop;
    if (top >= 0) {
      const nodeId = el.getAttribute('data-node-id');
      if (nodeId) return { nodeId, relativeTop: top };
    }
  }
  return null;
}

// Keeps the topmost visible node visually fixed across a proposition appearing or
// updating — otherwise content inserted above the viewport shifts the tree under the
// user. The proposition store notifies its version listeners synchronously before React
// re-renders, so the listener snapshots the anchor against the still-current DOM; the
// layout effect then corrects scrollTop once the new content has committed.
export function useScrollAnchor(containerRef: RefObject<HTMLElement | null>, revision: number): void {
  const pendingAnchor = useRef<Anchor | null>(null);

  useEffect(() => {
    return feedbackTreeStore.subscribeToVersion(() => {
      const container = containerRef.current;
      pendingAnchor.current = container ? findTopmostVisibleAnchor(container) : null;
    });
  }, [containerRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const anchor = pendingAnchor.current;
    pendingAnchor.current = null;
    if (!container || !anchor) return;

    const el = container.querySelector<HTMLElement>(`[data-node-id="${anchor.nodeId}"]`);
    if (!el) return;

    const newTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const delta = newTop - anchor.relativeTop;
    if (delta !== 0) {
      container.scrollTop += delta;
    }
  }, [revision, containerRef]);
}
