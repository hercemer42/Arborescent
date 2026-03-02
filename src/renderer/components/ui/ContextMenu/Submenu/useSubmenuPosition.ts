import { RefObject, useState, useLayoutEffect } from 'react';
import { createStore, useStore } from 'zustand';

interface SubmenuPosition {
  flipHorizontal: boolean;
  flipVertical: boolean;
  submenuRight: number;
}

const defaultPosition: SubmenuPosition = {
  flipHorizontal: false,
  flipVertical: false,
  submenuRight: 0,
};

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
    const flipVertical = rect.bottom > viewportHeight;

    store.setState({ flipHorizontal, flipVertical, submenuRight: rect.right });
  }, [submenuRef, store]);

  return useStore(store);
}
