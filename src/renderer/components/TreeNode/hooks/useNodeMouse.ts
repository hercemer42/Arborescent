import { useRef } from 'react';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { getPositionFromCoordinates } from '../../../utils/position';

export function useNodeMouse(nodeId: string) {
  const store = useActiveTreeStore();
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickingOnText = target.classList.contains('node-text');
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const hasModifierKey = isShift || isCtrlOrCmd || e.altKey;

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

    // Normal click: always clear selection (allows deselecting by clicking on selected node)
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

  return {
    handleMouseDown,
    handleMouseMove,
    handleClick,
  };
}
