import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useStore } from '../../store/tree/useStore';
import { TreeNode } from '../../../shared/types';
import {
  getCursorPosition,
  setCursorPosition,
  getVisualCursorPosition,
  setCursorToVisualPosition,
} from '../../services/cursorService';

export function useNodeContent(node: TreeNode) {
  const nodeTypeConfig = useStore((state) => state.nodeTypeConfig);
  const isSelected = useStore((state) => state.selectedNodeId === node.id);
  const cursorPosition = useStore(
    (state) => (state.selectedNodeId === node.id ? state.cursorPosition : 0)
  );
  const rememberedVisualX = useStore(
    (state) => (state.selectedNodeId === node.id ? state.rememberedVisualX : null)
  );
  const updateStatus = useStore((state) => state.actions.updateStatus);
  const updateContent = useStore((state) => state.actions.updateContent);
  const setCursorPositionAction = useStore((state) => state.actions.setCursorPosition);
  const setRememberedVisualX = useStore((state) => state.actions.setRememberedVisualX);
  const moveToPrevious = useStore((state) => state.actions.moveToPrevious);
  const moveToNext = useStore((state) => state.actions.moveToNext);
  const createSiblingNode = useStore((state) => state.actions.createSiblingNode);
  const indentNode = useStore((state) => state.actions.indentNode);
  const outdentNode = useStore((state) => state.actions.outdentNode);
  const moveNodeUp = useStore((state) => state.actions.moveNodeUp);
  const moveNodeDown = useStore((state) => state.actions.moveNodeDown);
  const deleteNode = useStore((state) => state.actions.deleteNode);

  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
  const hasChildren = node.children.length > 0;

  const contentRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  /* Sync content changes from store to DOM imperatively to avoid React re-renders
     that would reset the cursor position during typing */
  useEffect(() => {
    if (!contentRef.current) return;
    if (node.content === lastContentRef.current) return;

    const currentDOMContent = contentRef.current.textContent || '';
    if (currentDOMContent !== node.content) {
      contentRef.current.textContent = node.content;
    }

    lastContentRef.current = node.content;
  }, [node.content]);

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
  }, [isSelected, rememberedVisualX, cursorPosition, node.content.length, setCursorPositionAction, setRememberedVisualX, node.id]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (!contentRef.current) return;

    const newContent = e.currentTarget.textContent || '';
    lastContentRef.current = newContent;
    updateContent(node.id, newContent);

    const position = getCursorPosition(contentRef.current);
    setCursorPositionAction(position);
    setRememberedVisualX(null);
  };

  const handleArrowUpDown = () => {
    if (!contentRef.current) return;

    const position = getCursorPosition(contentRef.current);
    const contentLength = node.content.length;
    const visualX = getVisualCursorPosition();

    setCursorPositionAction(position);

    if (position < contentLength || rememberedVisualX === null) {
      setRememberedVisualX(visualX);
    }
  };

  const handleArrowLeft = (e: React.KeyboardEvent) => {
    if (!contentRef.current) return;

    const position = getCursorPosition(contentRef.current);
    if (position === 0) {
      e.preventDefault();
      moveToPrevious();
    } else {
      setRememberedVisualX(null);
      setCursorPositionAction(position - 1);
    }
  };

  const handleArrowRight = (e: React.KeyboardEvent) => {
    if (!contentRef.current) return;

    const position = getCursorPosition(contentRef.current);
    const contentLength = node.content.length;
    if (position === contentLength) {
      e.preventDefault();
      moveToNext();
    } else {
      setRememberedVisualX(null);
      setCursorPositionAction(position + 1);
    }
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (!contentRef.current) return;

    e.preventDefault();
    contentRef.current.textContent = node.content;
    contentRef.current.blur();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = () => {
    const deleted = deleteNode(node.id);
    if (!deleted) {
      const confirmed = window.confirm(
        'This node has children. Deleting it will also delete all its children. Are you sure?'
      );
      if (confirmed) {
        deleteNode(node.id, true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      if (e.shiftKey) {
        e.preventDefault();
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          setCursorPositionAction(position);
        }
        moveNodeUp(node.id);
      } else {
        handleArrowUpDown();
      }
    } else if (e.key === 'ArrowDown') {
      if (e.shiftKey) {
        e.preventDefault();
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          setCursorPositionAction(position);
        }
        moveNodeDown(node.id);
      } else {
        handleArrowUpDown();
      }
    } else if (e.key === 'ArrowLeft') {
      handleArrowLeft(e);
    } else if (e.key === 'ArrowRight') {
      handleArrowRight(e);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      createSiblingNode(node.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();

      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        setCursorPositionAction(position);
        setRememberedVisualX(null);
      }

      if (e.shiftKey) {
        outdentNode(node.id);
      } else {
        indentNode(node.id);
      }
    } else if (e.key === 'Escape') {
      handleEscape(e);
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();

      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        setCursorPositionAction(position);
      }

      handleDelete();
    }
  };

  return {
    config,
    hasChildren,
    isSelected,
    updateStatus,
    contentRef,
    handleKeyDown,
    handleInput,
    handleContextMenu,
    handleDelete,
    contextMenu,
    closeContextMenu: () => setContextMenu(null),
  };
}
