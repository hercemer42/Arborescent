import { RefObject } from 'react';
import { useEscapeKey } from './useEscapeKey';
import { useClickOutside } from './useClickOutside';

/**
 * Compound hook that combines escape key and click-outside behavior.
 * Used for dialogs, modals, dropdowns, and context menus.
 */
export function useDialogBehavior(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  useEscapeKey(onClose);
  useClickOutside(ref, onClose);
}
