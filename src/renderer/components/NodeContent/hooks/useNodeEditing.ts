import { useRef, useLayoutEffect, useCallback } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { convertFromContentEditable, convertToContentEditable } from '../../../utils/contentConversion';

export function useNodeEditing(node: TreeNode) {
  const updateContent = useStore((state) => state.actions.updateContent);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string | null>(null);
  const nodeContentRef = useRef(node.content);
  nodeContentRef.current = node.content;

  // Ref callback to populate content when element is attached
  // This handles switching from search highlight mode where a new empty element is created
  const setContentRef = useCallback((element: HTMLDivElement | null) => {
    contentRef.current = element;
    if (element) {
      const currentDOMContent = convertFromContentEditable(element);
      if (currentDOMContent !== nodeContentRef.current) {
        convertToContentEditable(element, nodeContentRef.current);
      }
    }
  }, []);

  /* Only update DOM if it differs from the store to avoid a re-render resetting the cursor position while typing */
  /* Use useLayoutEffect to ensure DOM updates BEFORE cursor positioning in useNodeCursor */
  useLayoutEffect(() => {
    if (!contentRef.current) return;
    if (node.content === lastContentRef.current) return;

    const currentDOMContent = convertFromContentEditable(contentRef.current);
    if (currentDOMContent !== node.content) {
      convertToContentEditable(contentRef.current, node.content);
    }

    lastContentRef.current = node.content;
  }, [node.content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!contentRef.current) return;

    const newContent = convertFromContentEditable(e.currentTarget);
    lastContentRef.current = newContent;
    updateContent(node.id, newContent);
  };

  return {
    contentRef,
    setContentRef,
    handleInput,
  };
}
