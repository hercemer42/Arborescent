import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeKeyboard } from '../useTreeKeyboard';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';

describe('useTreeKeyboard', () => {
  let store: TreeStore;
  const mockUndeleteNode = vi.fn();

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
        undeleteNode: mockUndeleteNode,
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

  it('should call undeleteNode on Ctrl+Shift+D', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true });
    window.dispatchEvent(event);

    expect(mockUndeleteNode).toHaveBeenCalledTimes(1);
  });

  it('should not call undeleteNode without correct modifiers', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'd' });
    window.dispatchEvent(event);

    expect(mockUndeleteNode).not.toHaveBeenCalled();
  });

  it('should prevent default when undelete hotkey is pressed', () => {
    renderHook(() => useTreeKeyboard(), { wrapper });

    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
