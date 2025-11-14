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

  // Track if node was previously selected to detect selection changes
  const wasSelectedRef = useRef(false);

  useLayoutEffect(() => {
    if (!isSelected || !contentRef.current || cursorPosition === null) {
      wasSelectedRef.current = isSelected;
      return;
    }

    // Only set cursor position if node is newly selected
    // This prevents overriding cursor position when user clicks within the node
    const isNewlySelected = !wasSelectedRef.current && isSelected;
    wasSelectedRef.current = isSelected;

    if (contentRef.current.childNodes.length === 0) {
      contentRef.current.appendChild(document.createTextNode(''));
    }

    contentRef.current.focus();

    if (isNewlySelected) {
      if (rememberedVisualX !== null) {
        setCursorToVisualPositionOnLine(contentRef.current, rememberedVisualX, cursorPosition);
      } else {
        setCursorPosition(contentRef.current, cursorPosition);
      }
    }
  }, [isSelected, rememberedVisualX, cursorPosition, node.id, contentRef]);
}
