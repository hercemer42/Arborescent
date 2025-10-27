import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeKeyboard } from '../useNodeKeyboard';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';

vi.mock('../../services/cursorService', () => ({
  getCursorPosition: vi.fn(() => 5),
  getVisualCursorPosition: vi.fn(() => 10),
}));

function createKeyboardEvent(
  key: string,
  options: {
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
  } = {}
): React.KeyboardEvent {
  const nativeEvent = new KeyboardEvent('keydown', {
    key,
    shiftKey: options.shiftKey || false,
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false,
    bubbles: true,
  });

  return {
    key,
    shiftKey: options.shiftKey || false,
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    nativeEvent,
  } as unknown as React.KeyboardEvent;
}

describe('useNodeKeyboard', () => {
  let store: TreeStore;
  const mockMoveBack = vi.fn();
  const mockMoveForward = vi.fn();
  const mockCreateSiblingNode = vi.fn();
  const mockIndentNode = vi.fn();
  const mockOutdentNode = vi.fn();
  const mockMoveNodeUp = vi.fn();
  const mockMoveNodeDown = vi.fn();
  const mockSetCursorPosition = vi.fn();
  const mockSetRememberedVisualX = vi.fn();
  const mockHandleDelete = vi.fn();
  const mockToggleStatus = vi.fn();

  const mockNode: TreeNode = {
    id: 'test-node',
    content: 'Test Content',
    children: [],
    metadata: {},
  };

  const mockContentRef = {
    current: {
      textContent: 'Test Content',
      blur: vi.fn(),
    } as unknown as HTMLDivElement,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: { 'test-node': mockNode },
      rootNodeId: 'test-node',
      selectedNodeId: 'test-node',
      cursorPosition: 5,
      rememberedVisualX: null,
      actions: {
        moveBack: mockMoveBack,
        moveForward: mockMoveForward,
        createSiblingNode: mockCreateSiblingNode,
        indentNode: mockIndentNode,
        outdentNode: mockOutdentNode,
        moveNodeUp: mockMoveNodeUp,
        moveNodeDown: mockMoveNodeDown,
        setCursorPosition: mockSetCursorPosition,
        setRememberedVisualX: mockSetRememberedVisualX,
        toggleStatus: mockToggleStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should return handleKeyDown function', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    expect(result.current.handleKeyDown).toBeInstanceOf(Function);
  });

  it('should create sibling node on Enter key', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('Enter');

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockCreateSiblingNode).toHaveBeenCalledWith('test-node');
  });

  it('should indent node on Tab key', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('Tab');

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockIndentNode).toHaveBeenCalledWith('test-node');
  });

  it('should outdent node on Shift+Tab', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('Tab', { shiftKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockOutdentNode).toHaveBeenCalledWith('test-node');
  });

  it('should move node up on Ctrl+ArrowUp', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('ArrowUp', { ctrlKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockMoveNodeUp).toHaveBeenCalledWith('test-node');
  });

  it('should move node down on Ctrl+ArrowDown', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('ArrowDown', { ctrlKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockMoveNodeDown).toHaveBeenCalledWith('test-node');
  });

  it('should move node up on Cmd+ArrowUp', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('ArrowUp', { metaKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockMoveNodeUp).toHaveBeenCalledWith('test-node');
  });

  it('should move node down on Cmd+ArrowDown', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('ArrowDown', { metaKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockMoveNodeDown).toHaveBeenCalledWith('test-node');
  });

  it('should handle delete on Ctrl+D', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('d', { ctrlKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockHandleDelete).toHaveBeenCalled();
  });

  it('should handle delete on Cmd+D', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('d', { metaKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockHandleDelete).toHaveBeenCalled();
  });

  it('should restore content and blur on Escape', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('Escape');

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockContentRef.current?.textContent).toBe('Test Content');
    expect(mockContentRef.current?.blur).toHaveBeenCalled();
  });

  it('should toggle status on Ctrl+K', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('k', { ctrlKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockToggleStatus).toHaveBeenCalledWith('test-node');
  });

  it('should toggle status on Cmd+K', () => {
    const { result } = renderHook(
      () =>
        useNodeKeyboard({
          node: mockNode,
          contentRef: mockContentRef,
          handleDelete: mockHandleDelete,
        }),
      { wrapper }
    );

    const mockEvent = createKeyboardEvent('k', { metaKey: true });

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockToggleStatus).toHaveBeenCalledWith('test-node');
  });
});
