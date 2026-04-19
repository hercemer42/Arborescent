import { RefObject, useState, useLayoutEffect } from 'react';
import { createStore, useStore } from 'zustand';

interface SubmenuPosition {
  flipHorizontal: boolean;
  flipVertical: boolean;
  submenuRight: number;
  maxHeight?: number;
}

const defaultPosition: SubmenuPosition = {
  flipHorizontal: false,
  flipVertical: false,
  submenuRight: 0,
};

const VIEWPORT_EDGE_BUFFER = 10;

export function useSubmenuPosition(
  submenuRef: RefObject<HTMLDivElement | null>
): SubmenuPosition {
  const [store] = useState(() => createStore<SubmenuPosition>(() => defaultPosition));

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    if (!submenu) return;

    const rect = submenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const flipHorizontal = rect.right > viewportWidth;

    const parent = submenu.parentElement;
    if (!parent) {
      store.setState({
        flipHorizontal,
        flipVertical: rect.bottom > viewportHeight,
        submenuRight: rect.right,
        maxHeight: undefined,
      });
      return;
    }

    const parentRect = parent.getBoundingClientRect();
    const spaceAbove = parentRect.top;
    const spaceBelow = viewportHeight - parentRect.bottom;
    const submenuHeight = rect.bottom - rect.top;

    const fitsBelow = submenuHeight <= spaceBelow;
    const fitsAbove = submenuHeight <= spaceAbove;

    let flipVertical: boolean;
    let maxHeight: number | undefined;

    if (fitsBelow) {
      flipVertical = false;
      maxHeight = undefined;
    } else if (fitsAbove) {
      flipVertical = true;
      maxHeight = undefined;
    } else {
      flipVertical = spaceAbove > spaceBelow;
      const available = flipVertical ? spaceAbove : spaceBelow;
      maxHeight = Math.max(available - VIEWPORT_EDGE_BUFFER, 0);
    }

    store.setState({ flipHorizontal, flipVertical, submenuRight: rect.right, maxHeight });
  }, [submenuRef, store]);

  return useStore(store);
}
