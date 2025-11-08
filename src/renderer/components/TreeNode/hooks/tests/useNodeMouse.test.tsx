import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeMouse } from '../useNodeMouse';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';

vi.mock('../../../../utils/position', () => ({
  getPositionFromCoordinates: vi.fn(() => 5),
}));

describe('useNodeMouse', () => {
  let store: TreeStore;
  const mockSelectNode = vi.fn();
  const mockSetRememberedVisualX = vi.fn();
  const mockClearSelection = vi.fn();
  const mockSelectRange = vi.fn();
  const mockToggleNodeSelection = vi.fn();
  const nodeId = 'test-node';

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        selectNode: mockSelectNode,
        setRememberedVisualX: mockSetRememberedVisualX,
        clearSelection: mockClearSelection,
        selectRange: mockSelectRange,
        toggleNodeSelection: mockToggleNodeSelection,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should return mouse event handlers', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    expect(result.current.handleMouseDown).toBeInstanceOf(Function);
    expect(result.current.handleMouseMove).toBeInstanceOf(Function);
    expect(result.current.handleClick).toBeInstanceOf(Function);
  });

  it('should track mouse position on mousedown', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    const mockEvent = {
      target: { classList: { contains: () => false } },
      clientX: 100,
      clientY: 200,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should not prevent default on text clicks', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    const mockEvent = {
      target: { classList: { contains: (cls: string) => cls === 'node-text' } },
      clientX: 100,
      clientY: 200,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('should not prevent default on modifier key clicks', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    const mockEvent = {
      target: { classList: { contains: () => false } },
      clientX: 100,
      clientY: 200,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('should select node with cursor position on click', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    // Simulate mousedown first
    const mouseDownEvent = {
      target: { classList: { contains: () => false } },
      clientX: 100,
      clientY: 200,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mouseDownEvent);
    });

    // Then click
    const clickEvent = {
      currentTarget: {
        querySelector: () => ({
          tagName: 'DIV',
          getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20 }),
          textContent: 'test content',
        }),
      },
      clientX: 100,
      clientY: 200,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleClick(clickEvent);
    });

    expect(mockSetRememberedVisualX).toHaveBeenCalledWith(null);
    expect(mockSelectNode).toHaveBeenCalledWith(nodeId, 5);
  });

  it('should not select on modifier key click', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    const mouseDownEvent = {
      target: { classList: { contains: () => false } },
      clientX: 100,
      clientY: 200,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mouseDownEvent);
    });

    const clickEvent = {
      currentTarget: {
        querySelector: () => ({ tagName: 'DIV' }),
      },
      clientX: 100,
      clientY: 200,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleClick(clickEvent);
    });

    expect(mockSelectNode).not.toHaveBeenCalled();
  });

  it('should detect drag and not select on click', () => {
    const { result } = renderHook(() => useNodeMouse(nodeId), { wrapper });

    // Mousedown
    const mouseDownEvent = {
      target: { classList: { contains: () => false } },
      clientX: 100,
      clientY: 200,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mouseDownEvent);
    });

    // Mousemove (drag detected)
    const mouseMoveEvent = {
      clientX: 120,
      clientY: 220,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseMove(mouseMoveEvent);
    });

    // Click
    const clickEvent = {
      currentTarget: {
        querySelector: () => ({ tagName: 'DIV' }),
      },
      clientX: 120,
      clientY: 220,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleClick(clickEvent);
    });

    expect(mockSelectNode).not.toHaveBeenCalled();
  });
});
