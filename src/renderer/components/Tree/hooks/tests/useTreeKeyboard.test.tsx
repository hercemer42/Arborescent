import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeKeyboard } from '../useTreeKeyboard';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';

describe('useTreeKeyboard', () => {
  let store: TreeStore;
  const mockMoveUp = vi.fn();
  const mockMoveDown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: {
        root: {
          id: 'root',
          content: '',
          children: ['node-1'],
          metadata: { status: 'pending' },
        },
        'node-1': {
          id: 'node-1',
          content: 'Test Node',
          children: [],
          metadata: { status: 'pending' },
        },
      },
      rootNodeId: 'root',
      selectedNodeId: 'node-1',
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        moveUp: mockMoveUp,
        moveDown: mockMoveDown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should register keydown listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useTreeKeyboard(), { wrapper });

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should unregister keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useTreeKeyboard(), { wrapper });
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should focus selected node on ArrowUp', () => {
    const focusSpy = vi.fn();
    const mockElement = { focus: focusSpy } as unknown as HTMLElement;
    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue(mockElement);

    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    window.dispatchEvent(event);

    expect(querySelectorSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('should focus selected node on ArrowDown', () => {
    const focusSpy = vi.fn();
    const mockElement = { focus: focusSpy } as unknown as HTMLElement;
    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue(mockElement);

    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    window.dispatchEvent(event);

    expect(querySelectorSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('should not call moveUp when Shift is pressed', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true });
    window.dispatchEvent(event);

    expect(mockMoveUp).not.toHaveBeenCalled();
  });

  it('should not call moveDown when Ctrl is pressed', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true });
    window.dispatchEvent(event);

    expect(mockMoveDown).not.toHaveBeenCalled();
  });

  it('should not call moveUp when Meta is pressed', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', metaKey: true });
    window.dispatchEvent(event);

    expect(mockMoveUp).not.toHaveBeenCalled();
  });

  it('should not call moveDown when Alt is pressed', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true });
    window.dispatchEvent(event);

    expect(mockMoveDown).not.toHaveBeenCalled();
  });
});
