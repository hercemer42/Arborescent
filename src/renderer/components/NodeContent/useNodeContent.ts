import { useRef, useEffect } from 'react';
import { useTreeStore } from '../../store/treeStore';
import { TreeNode } from '../../../shared/types';
import { getCursorPosition, setCursorPosition } from '../../services/cursorService';

export function useNodeContent(node: TreeNode) {
  const nodeTypeConfig = useTreeStore((state) => state.nodeTypeConfig);
  const isSelected = useTreeStore((state) => state.selectedNodeId === node.id);
  const cursorPosition = useTreeStore((state) =>
    state.selectedNodeId === node.id ? state.cursorPosition : 0
  );
  const updateStatus = useTreeStore((state) => state.actions.updateStatus);
  const selectNode = useTreeStore((state) => state.actions.selectNode);
  const updateContent = useTreeStore((state) => state.actions.updateContent);
  const setCursorPositionAction = useTreeStore((state) => state.actions.setCursorPosition);
  const setRememberedCursorColumn = useTreeStore((state) => state.actions.setRememberedCursorColumn);

  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
  const hasChildren = node.children.length > 0;

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && contentRef.current) {
      contentRef.current.focus();
      setCursorPosition(contentRef.current, cursorPosition);
    }
  }, [isSelected, cursorPosition]);

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
          setRememberedCursorColumn(null);
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
        setCursorPositionAction(position);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      setRememberedCursorColumn(null);

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
