import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockUseDraggable, mockUseDroppable } = vi.hoisted(() => ({
  mockUseDraggable: vi.fn(),
  mockUseDroppable: vi.fn(),
}));

vi.mock('@dnd-kit/core', () => ({
  useDraggable: mockUseDraggable,
  useDroppable: mockUseDroppable,
}));

import { useNodeDragDrop } from '../useNodeDragDrop';

describe('useNodeDragDrop', () => {
  const mockSetDraggableRef = vi.fn();
  const mockSetDroppableRef = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: mockSetDraggableRef,
      isDragging: false,
    });

    mockUseDroppable.mockReturnValue({
      setNodeRef: mockSetDroppableRef,
      isOver: false,
    });
  });

  it('should return null dropPosition when not over', () => {
    const nodeRef = { current: null } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    expect(result.current.dropPosition).toBeNull();
    expect(result.current.isOver).toBe(false);
  });

  it('should default dropPosition to child when isOver but no mouse move yet', () => {
    mockUseDroppable.mockReturnValue({
      setNodeRef: mockSetDroppableRef,
      isOver: true,
    });

    const nodeRef = { current: document.createElement('div') } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    expect(result.current.dropPosition).toBe('child');
    expect(result.current.isOver).toBe(true);
  });

  it('should set dropPosition to before when mouse is in top 25%', () => {
    mockUseDroppable.mockReturnValue({
      setNodeRef: mockSetDroppableRef,
      isOver: true,
    });

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 200, left: 0, right: 100, height: 100, width: 100,
      x: 0, y: 100, toJSON: () => {},
    });

    const nodeRef = { current: element } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 110 }));
    });

    expect(result.current.dropPosition).toBe('before');
  });

  it('should set dropPosition to child when mouse is in middle 50%', () => {
    mockUseDroppable.mockReturnValue({
      setNodeRef: mockSetDroppableRef,
      isOver: true,
    });

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 200, left: 0, right: 100, height: 100, width: 100,
      x: 0, y: 100, toJSON: () => {},
    });

    const nodeRef = { current: element } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 150 }));
    });

    expect(result.current.dropPosition).toBe('child');
  });

  it('should set dropPosition to after when mouse is in bottom 25%', () => {
    mockUseDroppable.mockReturnValue({
      setNodeRef: mockSetDroppableRef,
      isOver: true,
    });

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 200, left: 0, right: 100, height: 100, width: 100,
      x: 0, y: 100, toJSON: () => {},
    });

    const nodeRef = { current: element } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 190 }));
    });

    expect(result.current.dropPosition).toBe('after');
  });

  it('should reset dropPosition to null when no longer over', () => {
    mockUseDroppable.mockReturnValue({
      setNodeRef: mockSetDroppableRef,
      isOver: true,
    });

    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 200, left: 0, right: 100, height: 100, width: 100,
      x: 0, y: 100, toJSON: () => {},
    });

    const nodeRef = { current: element } as React.RefObject<HTMLDivElement | null>;
    const { result, rerender } = renderHook(
      ({ isOver }) => {
        mockUseDroppable.mockReturnValue({
          setNodeRef: mockSetDroppableRef,
          isOver,
        });
        return useNodeDragDrop('node-1', nodeRef);
      },
      { initialProps: { isOver: true } },
    );

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 190 }));
    });

    expect(result.current.dropPosition).toBe('after');

    rerender({ isOver: false });

    expect(result.current.dropPosition).toBeNull();
  });

  it('should set refs for both draggable and droppable', () => {
    const nodeRef = { current: null } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    const element = document.createElement('div');
    act(() => {
      result.current.setRefs(element);
    });

    expect(mockSetDraggableRef).toHaveBeenCalledWith(element);
    expect(mockSetDroppableRef).toHaveBeenCalledWith(element);
  });

  it('should report isDragging state', () => {
    mockUseDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: mockSetDraggableRef,
      isDragging: true,
    });

    const nodeRef = { current: null } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useNodeDragDrop('node-1', nodeRef));

    expect(result.current.isDragging).toBe(true);
  });
});
