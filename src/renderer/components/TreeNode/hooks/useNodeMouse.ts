import { useRef, useMemo } from 'react';
import { DraggableSyntheticListeners } from '@dnd-kit/core';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { getPositionFromPoint } from '../../../utils/position';

export function useNodeMouse(nodeId: string, listeners?: DraggableSyntheticListeners) {
  const store = useActiveTreeStore();
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  // Wrap drag listeners to only allow drag if node is multi-selected
  const wrappedListeners = useMemo(() => {
    if (!listeners) return undefined;

    return Object.keys(listeners).reduce((acc, key) => {
      const originalHandler = listeners[key];
      if (typeof originalHandler === 'function') {
        acc[key] = (e: React.PointerEvent) => {
          // Skip drag if modifier keys pressed (user wants to select, not drag)
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            return;
          }

          // Only allow drag if node is already multi-selected
          const state = store.getState();
          if (!state.multiSelectedNodeIds.has(nodeId)) {
            return;
          }

          originalHandler(e);
        };
      } else {
        acc[key] = originalHandler;
      }
      return acc;
    }, {} as Record<string, unknown>);
  }, [listeners, nodeId, store]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isClickingOnText = target.classList.contains('node-text');
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const hasModifierKey = isShift || isCtrlOrCmd || e.altKey;

    // Modifier keys are ONLY for node multi-selection, never for text selection or cursor placement
    if (hasModifierKey) {
      e.preventDefault(); // Prevent text selection
      mouseDownPos.current = null;
      return;
    }

    // Track mouse position for drag detection (only for normal clicks)
    mouseDownPos.current = { x: e.clientX, y: e.clientY };

    // Prevent default browser selection when clicking on gaps/icons/wrappers
    // but allow natural behavior for text clicks
    if (!isClickingOnText) {
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
    const hasModifierKey = isCtrlOrCmd || isShift;

    // Check if clicking on a button
    const target = e.target as HTMLElement;
    const isClickingOnButton = target && (target.tagName === 'BUTTON' || target.closest?.('button'));

    // If clicking on button WITHOUT modifier keys, let button handle it (don't place cursor)
    if (isClickingOnButton && !hasModifierKey) {
      return;
    }

    // Hyperlink text click: skip selection, let onClick handler navigate
    const isClickingOnHyperlink = target.classList.contains('hyperlink-text');
    if (isClickingOnHyperlink && !hasModifierKey) {
      return;
    }

    // Handle Ctrl/Cmd+Click: ONLY toggle node multi-selection
    if (isCtrlOrCmd && !isShift) {
      actions.toggleNodeSelection(nodeId);
      // Clear any cursor
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return;
    }

    // Handle Shift+Click: ONLY do node range selection
    if (isShift) {
      actions.selectRange(nodeId);
      // Clear any cursor
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return;
    }

    // If drag detected or using alt key, don't do anything
    if (!mouseDownPos.current || e.altKey) {
      mouseDownPos.current = null;
      return;
    }
    mouseDownPos.current = null;

    // Normal click: clear multi-selection and place cursor
    actions.clearSelection();

    const wrapperElement = e.currentTarget as HTMLElement;
    const contentEditableElement = wrapperElement.querySelector('.node-text') as HTMLElement;

    if (!contentEditableElement) return;

    // Calculate correct cursor position from click coordinates (including Y for multiline support)
    const position = getPositionFromPoint(
      contentEditableElement,
      e.clientX,
      e.clientY
    );

    actions.setRememberedVisualX(null);
    actions.selectNode(nodeId, position);
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleClick,
    wrappedListeners,
  };
}
