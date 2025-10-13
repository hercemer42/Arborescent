import { useRef } from 'react';
import { useStore } from '../../store/tree/useStore';
import { getPositionFromCoordinates } from '../../utils/position';

/**
 * Custom hook for handling mouse interactions on tree nodes to enable
 * coordinate-based cursor positioning. This works around contentEditable's
 * default behavior of placing cursor at start/end when clicking on padding/gaps.
 */
export function useNodeClick(nodeId: string) {
  const selectNode = useStore((state) => state.actions.selectNode);
  const setRememberedVisualX = useStore((state) => state.actions.setRememberedVisualX);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickingOnText = target.classList.contains('node-text');
    const hasModifierKey = e.shiftKey || e.metaKey || e.ctrlKey || e.altKey;

    // Track mouse position for drag detection, but skip for modifier key clicks
    // (shift-click, ctrl-click, etc. are for selection operations, not cursor placement)
    mouseDownPos.current = hasModifierKey ? null : { x: e.clientX, y: e.clientY };

    // Prevent default browser selection when clicking on gaps/icons/wrappers
    // but allow natural behavior for text clicks and modifier key operations
    if (!isClickingOnText && !hasModifierKey) {
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;

    // Detect drag: if mouse moved more than 5px, clear position to indicate dragging
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);

    if (dx > 5 || dy > 5) {
      mouseDownPos.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If drag detected or using modifier keys, let browser handle naturally
    if (!mouseDownPos.current || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
      mouseDownPos.current = null;
      return;
    }
    mouseDownPos.current = null;

    // Find the contentEditable element to position cursor in
    const wrapperElement = e.currentTarget as HTMLElement;
    const contentEditableElement = wrapperElement.querySelector('.node-text') as HTMLElement;

    if (!contentEditableElement) return;

    // Calculate correct cursor position from click coordinates
    const position = getPositionFromCoordinates(
      contentEditableElement,
      e.clientX,
      e.clientY
    );

    setRememberedVisualX(null);
    selectNode(nodeId, position);
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleClick,
  };
}
