import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import {
  getCursorPosition,
  getVisualCursorPosition,
} from '../../../services/cursorService';
import { matchesHotkey } from '../../../data/hotkeyConfig';

interface UseNodeKeyboardProps {
  node: TreeNode;
  contentRef: React.RefObject<HTMLDivElement | null>;
  handleDelete: () => void;
}

export function useNodeKeyboard({
  node,
  contentRef,
  handleDelete,
}: UseNodeKeyboardProps) {
  const rememberedVisualX = useStore((state) => state.rememberedVisualX);
  const setCursorPosition = useStore((state) => state.actions.setCursorPosition);
  const setRememberedVisualX = useStore((state) => state.actions.setRememberedVisualX);
  const moveToPrevious = useStore((state) => state.actions.moveToPrevious);
  const moveToNext = useStore((state) => state.actions.moveToNext);
  const moveUp = useStore((state) => state.actions.moveUp);
  const moveDown = useStore((state) => state.actions.moveDown);
  const createSiblingNode = useStore((state) => state.actions.createSiblingNode);
  const indentNode = useStore((state) => state.actions.indentNode);
  const outdentNode = useStore((state) => state.actions.outdentNode);
  const moveNodeUp = useStore((state) => state.actions.moveNodeUp);
  const moveNodeDown = useStore((state) => state.actions.moveNodeDown);
  const toggleNode = useStore((state) => state.actions.toggleNode);

  const handleArrowUpDown = (e: React.KeyboardEvent, direction: 'up' | 'down') => {
    if (!contentRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const position = getCursorPosition(contentRef.current);

    setCursorPosition(position);

    if (rememberedVisualX === null) {
      const visualX = getVisualCursorPosition();
      setRememberedVisualX(visualX);
    }

    if (direction === 'up') {
      moveUp();
    } else {
      moveDown();
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
    }
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (!contentRef.current) return;

    e.preventDefault();
    contentRef.current.textContent = node.content;
    contentRef.current.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const event = e.nativeEvent as KeyboardEvent;

    if (e.key === 'ArrowUp') {
      if (e.shiftKey) {
        e.preventDefault();
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          setCursorPosition(position);
        }
        moveNodeUp(node.id);
      } else {
        handleArrowUpDown(e, 'up');
      }
    } else if (e.key === 'ArrowDown') {
      if (e.shiftKey) {
        e.preventDefault();
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          setCursorPosition(position);
        }
        moveNodeDown(node.id);
      } else {
        handleArrowUpDown(e, 'down');
      }
    } else if (e.key === 'ArrowLeft') {
      handleArrowLeft(e);
    } else if (e.key === 'ArrowRight') {
      handleArrowRight(e);
    } else if (matchesHotkey(event, 'editing', 'newSiblingAfter')) {
      e.preventDefault();
      createSiblingNode(node.id);
    } else if (matchesHotkey(event, 'editing', 'outdent')) {
      e.preventDefault();

      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        setCursorPosition(position);
        setRememberedVisualX(null);
      }

      outdentNode(node.id);
    } else if (matchesHotkey(event, 'editing', 'indent')) {
      e.preventDefault();

      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        setCursorPosition(position);
        setRememberedVisualX(null);
      }

      indentNode(node.id);
    } else if (matchesHotkey(event, 'editing', 'cancelEdit')) {
      handleEscape(e);
    } else if (matchesHotkey(event, 'actions', 'deleteNode')) {
      e.preventDefault();

      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        setCursorPosition(position);
      }

      handleDelete();
    } else if (matchesHotkey(event, 'navigation', 'toggleNode')) {
      e.preventDefault();

      if (contentRef.current) {
        const position = getCursorPosition(contentRef.current);
        setCursorPosition(position);
      }

      toggleNode(node.id);
    }
  };

  return {
    handleKeyDown,
  };
}
