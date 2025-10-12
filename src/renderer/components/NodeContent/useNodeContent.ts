import { useRef, useEffect } from 'react';
import { useTreeStore } from '../../store/treeStore';
import { TreeNode } from '../../../shared/types';
import { getCursorPosition, setCursorPosition, getVisualCursorPosition, setCursorToVisualPosition } from '../../services/cursorService';

export function useNodeContent(node: TreeNode) {
  const nodeTypeConfig = useTreeStore((state) => state.nodeTypeConfig);
  const isSelected = useTreeStore((state) => state.selectedNodeId === node.id);
  const cursorPosition = useTreeStore((state) =>
    state.selectedNodeId === node.id ? state.cursorPosition : 0
  );
  const rememberedVisualX = useTreeStore((state) =>
    state.selectedNodeId === node.id ? state.rememberedVisualX : null
  );
  const updateStatus = useTreeStore((state) => state.actions.updateStatus);
  const selectNode = useTreeStore((state) => state.actions.selectNode);
  const updateContent = useTreeStore((state) => state.actions.updateContent);
  const setCursorPositionAction = useTreeStore((state) => state.actions.setCursorPosition);
  const setRememberedVisualX = useTreeStore((state) => state.actions.setRememberedVisualX);

  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
  const hasChildren = node.children.length > 0;

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && contentRef.current) {
      contentRef.current.focus();

      if (rememberedVisualX !== null) {
        const newPosition = setCursorToVisualPosition(contentRef.current, rememberedVisualX);
        setCursorPositionAction(newPosition);

        const contentLength = node.content.length;
        if (newPosition < contentLength) {
          const actualVisualX = getVisualCursorPosition();
          setRememberedVisualX(actualVisualX);
        }
      } else {
        setCursorPosition(contentRef.current, cursorPosition);
      }
    }
  }, [isSelected, cursorPosition, rememberedVisualX]);

  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== node.content) {
      const savedPosition = getCursorPosition(contentRef.current);
      contentRef.current.textContent = node.content;
      if (isSelected) {
        setCursorPosition(contentRef.current, savedPosition);
      }
    }
  }, [node.content, isSelected]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const selection = window.getSelection();
    if (contentRef.current && selection) {
      setTimeout(() => {
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          selectNode(node.id, position);
          setRememberedVisualX(null);
        }
      }, 0);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || '';

    if (contentRef.current) {
      const position = getCursorPosition(contentRef.current);
      updateContent(node.id, newContent);
      setCursorPositionAction(position);
    } else {
      updateContent(node.id, newContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        const contentLength = node.content.length;
        const visualX = getVisualCursorPosition();

        setCursorPositionAction(position);

        if (position < contentLength || rememberedVisualX === null) {
          setRememberedVisualX(visualX);
        }
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      setRememberedVisualX(null);

      setTimeout(() => {
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          setCursorPositionAction(position);
        }
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (contentRef.current) {
        contentRef.current.textContent = node.content;
      }
      contentRef.current?.blur();
    }
  };

  return {
    config,
    hasChildren,
    isSelected,
    handleClick,
    updateStatus,
    contentRef,
    handleKeyDown,
    handleInput,
  };
}
