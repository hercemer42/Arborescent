import { useLayoutEffect } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import {
  setCursorPosition,
  setCursorToVisualPosition,
} from '../../../services/cursorService';

export function useNodeCursor(node: TreeNode, contentRef: React.RefObject<HTMLDivElement | null>) {
  const isSelected = useStore((state) => state.selectedNodeId === node.id);
  const cursorPosition = useStore((state) => state.cursorPosition);
  const rememberedVisualX = useStore((state) => state.rememberedVisualX);

  useLayoutEffect(() => {
    if (!isSelected || !contentRef.current) return;

    if (contentRef.current.childNodes.length === 0) {
      contentRef.current.appendChild(document.createTextNode(''));
    }

    contentRef.current.focus();

    if (rememberedVisualX !== null) {
      setCursorToVisualPosition(contentRef.current, rememberedVisualX);
    } else {
      setCursorPosition(contentRef.current, cursorPosition);
    }
  }, [isSelected, rememberedVisualX, cursorPosition, node.id, contentRef]);
}
