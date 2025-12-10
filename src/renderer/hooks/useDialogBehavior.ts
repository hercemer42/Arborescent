import { RefObject } from 'react';
import { useEscapeKey } from './useEscapeKey';
import { useClickOutside } from './useClickOutside';

export function useDialogBehavior(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
): void {
  useEscapeKey(onClose);
  useClickOutside(ref, onClose);
}
