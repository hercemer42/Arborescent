import { useLayoutEffect } from 'react';
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

  useLayoutEffect(() => {
    if (!isSelected || !contentRef.current || cursorPosition === null) return;

    if (contentRef.current.childNodes.length === 0) {
      contentRef.current.appendChild(document.createTextNode(''));
    }

    contentRef.current.focus();

    if (rememberedVisualX !== null) {
      setCursorToVisualPositionOnLine(contentRef.current, rememberedVisualX, cursorPosition);
    } else {
      setCursorPosition(contentRef.current, cursorPosition);
    }
  }, [isSelected, rememberedVisualX, cursorPosition, node.id, contentRef]);
}
