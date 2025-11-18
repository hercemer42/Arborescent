import { useLayoutEffect, useRef } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import {
  setCursorPosition,
  setCursorToVisualPositionOnLine,
} from '../../../services/cursorService';

export function useNodeCursor(node: TreeNode, contentRef: React.RefObject<HTMLDivElement | null>) {
  const isSelected = useStore((state) => state.activeNodeId === node.id);
  const cursorPosition = useStore((state) =>
    state.activeNodeId === node.id ? state.cursorPosition : null
  );
  const rememberedVisualX = useStore((state) =>
    state.activeNodeId === node.id ? state.rememberedVisualX : null
  );

  // Track if node was previously selected and last cursor position
  const wasSelectedRef = useRef(false);
  const lastCursorPositionRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!isSelected || !contentRef.current || cursorPosition === null) {
      wasSelectedRef.current = isSelected;
      lastCursorPositionRef.current = cursorPosition;
      return;
    }

    const isNewlySelected = !wasSelectedRef.current && isSelected;
    const cursorPositionChanged = lastCursorPositionRef.current !== cursorPosition;

    wasSelectedRef.current = isSelected;
    lastCursorPositionRef.current = cursorPosition;

    if (contentRef.current.childNodes.length === 0) {
      contentRef.current.appendChild(document.createTextNode(''));
    }

    contentRef.current.focus();

    // Set cursor position if:
    // 1. Node is newly selected, OR
    // 2. Cursor position changed programmatically (e.g., from undo/redo)
    // Note: useNodeEditing uses useLayoutEffect to update DOM content BEFORE this runs
    if (isNewlySelected || cursorPositionChanged) {
      if (rememberedVisualX !== null) {
        setCursorToVisualPositionOnLine(contentRef.current, rememberedVisualX, cursorPosition);
      } else {
        setCursorPosition(contentRef.current, cursorPosition);
      }
    }
  }, [isSelected, rememberedVisualX, cursorPosition, node.id, node.content.length, contentRef]);
}
