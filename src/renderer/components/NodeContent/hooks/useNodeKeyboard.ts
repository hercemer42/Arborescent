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
  rememberedVisualX: number | null;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  handleDelete: () => void;
}

export function useNodeKeyboard({
  node,
  contentRef,
  rememberedVisualX,
  setCursorPosition,
  setRememberedVisualX,
  handleDelete,
}: UseNodeKeyboardProps) {
  const moveToPrevious = useStore((state) => state.actions.moveToPrevious);
  const moveToNext = useStore((state) => state.actions.moveToNext);
  const createSiblingNode = useStore((state) => state.actions.createSiblingNode);
  const indentNode = useStore((state) => state.actions.indentNode);
  const outdentNode = useStore((state) => state.actions.outdentNode);
  const moveNodeUp = useStore((state) => state.actions.moveNodeUp);
  const moveNodeDown = useStore((state) => state.actions.moveNodeDown);

  const handleArrowUpDown = () => {
    if (!contentRef.current) return;

    const position = getCursorPosition(contentRef.current);
    const contentLength = node.content.length;
    const visualX = getVisualCursorPosition();

    setCursorPosition(position);

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
      setCursorPosition(position - 1);
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
      setCursorPosition(position + 1);
    }
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (!contentRef.current) return;

    e.preventDefault();
    contentRef.current.textContent = node.content;
    contentRef.current.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Use nativeEvent for real events, fallback to e for test mocks
    const event = (e.nativeEvent || e) as KeyboardEvent;

    if (e.key === 'ArrowUp') {
      if (e.shiftKey) {
        e.preventDefault();
        if (contentRef.current) {
          const position = getCursorPosition(contentRef.current);
          setCursorPosition(position);
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
          setCursorPosition(position);
        }
        moveNodeDown(node.id);
      } else {
        handleArrowUpDown();
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
    }
  };

  return {
    handleKeyDown,
  };
}
