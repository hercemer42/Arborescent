import { useLayoutEffect } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import {
  setCursorPosition,
  getVisualCursorPosition,
  setCursorToVisualPosition,
} from '../../../services/cursorService';

export function useNodeCursor(node: TreeNode, contentRef: React.RefObject<HTMLDivElement | null>) {
  const isSelected = useStore((state) => state.selectedNodeId === node.id);
  const cursorPosition = useStore((state) => state.cursorPosition);
  const rememberedVisualX = useStore((state) => state.rememberedVisualX);
  const setCursorPositionAction = useStore((state) => state.actions.setCursorPosition);
  const setRememberedVisualX = useStore((state) => state.actions.setRememberedVisualX);

  /* Focus and set cursor position when node is selected */
  useLayoutEffect(() => {
    if (!isSelected || !contentRef.current) return;

    if (contentRef.current.childNodes.length === 0) {
      contentRef.current.appendChild(document.createTextNode(''));
    }

    contentRef.current.focus();

    if (rememberedVisualX !== null) {
      const newPosition = setCursorToVisualPosition(contentRef.current, rememberedVisualX);
      setCursorPositionAction(newPosition);

      if (newPosition < node.content.length) {
        const actualVisualX = getVisualCursorPosition();
        setRememberedVisualX(actualVisualX);
      }
    } else {
      setCursorPosition(contentRef.current, cursorPosition);
    }
  }, [
    isSelected,
    rememberedVisualX,
    cursorPosition,
    node.content.length,
    setCursorPositionAction,
    setRememberedVisualX,
    node.id,
    contentRef,
  ]);

  return {
    cursorPosition,
    rememberedVisualX,
    setCursorPosition: setCursorPositionAction,
    setRememberedVisualX,
  };
}
