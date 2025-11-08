import { useRef, useEffect } from 'react';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { getPositionFromCoordinates } from '../../../utils/position';

export function useNodeMouse(nodeId: string) {
  const store = useActiveTreeStore();
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHoldTimeout = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickingOnText = target.classList.contains('node-text');
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const hasModifierKey = isShift || isCtrlOrCmd || e.altKey;

    // Track mouse position for drag detection, but skip for modifier key clicks
    // (shift-click, ctrl-click, etc. are for selection operations, not cursor placement)
    mouseDownPos.current = hasModifierKey ? null : { x: e.clientX, y: e.clientY };

    // Clear any existing hold timeout
    clearHoldTimeout();

    // For normal clicks (no modifiers), start a 1-second timeout to show selection
    // This gives visual feedback when holding before dragging
    if (!hasModifierKey) {
      holdTimeoutRef.current = setTimeout(() => {
        const { actions, selectedNodeIds } = store.getState();

        // Only add to selection if not already selected
        if (!selectedNodeIds.has(nodeId)) {
          actions.clearSelection();
          actions.addToSelection([nodeId]);
        }

        holdTimeoutRef.current = null;
      }, 500);
    }

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
      clearHoldTimeout();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    clearHoldTimeout();

    const { actions } = store.getState();
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // Handle Ctrl/Cmd+Click: toggle node in/out of multi-select
    if (isCtrlOrCmd && !isShift) {
      mouseDownPos.current = null;
      actions.toggleNodeSelection(nodeId);
      return;
    }

    // Handle Shift+Click: range selection
    if (isShift) {
      mouseDownPos.current = null;
      actions.selectRange(nodeId);
      return;
    }

    // If drag detected or using alt key, let browser handle naturally
    if (!mouseDownPos.current || e.altKey) {
      mouseDownPos.current = null;
      return;
    }
    mouseDownPos.current = null;

    // Normal click: clear multi-selection and select this node
    actions.clearSelection();

    // Find the contentEditable element to position cursor in
    const wrapperElement = e.currentTarget as HTMLElement;
    const contentEditableElement = wrapperElement.querySelector('.node-text') as HTMLElement;

    if (!contentEditableElement) return;

    // Calculate correct cursor position from click coordinates
    const position = getPositionFromCoordinates(
      contentEditableElement,
      e.clientX
    );

    actions.setRememberedVisualX(null);
    actions.selectNode(nodeId, position);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearHoldTimeout();
    };
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleClick,
  };
}
