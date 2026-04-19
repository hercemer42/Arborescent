import type { ContextMenuItem } from '../../../ui/ContextMenu';
import { getKeyForAction } from '../../../../utils/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../../../utils/hotkeyUtils';

export interface EditSubmenuHandlers {
  onSelect: () => void;
  onCopy: () => void;
  onCopyAsHyperlink?: () => void;
  onCut: () => void;
  onPaste?: () => void;
  onDelete: () => void;
}

/**
 * Pure submenu builder for the standard Edit actions on a node (select,
 * copy, cut, paste, delete). The workspace tree exposes all entries; the
 * feedback tree omits the hyperlink-aware variants. Keeping this in one
 * place prevents the two call sites in useNodeContextMenu from drifting.
 */
export function buildEditSubmenu({
  onSelect,
  onCopy,
  onCopyAsHyperlink,
  onCut,
  onPaste,
  onDelete,
}: EditSubmenuHandlers): ContextMenuItem {
  const items: ContextMenuItem[] = [
    { label: 'Select', onClick: onSelect },
    {
      label: 'Copy',
      onClick: onCopy,
      shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'copy') || ''),
    },
  ];

  if (onCopyAsHyperlink) {
    items.push({ label: 'Copy as Hyperlink', onClick: onCopyAsHyperlink });
  }

  items.push({
    label: 'Cut',
    onClick: onCut,
    shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'cut') || ''),
  });

  if (onPaste) {
    items.push({
      label: 'Paste',
      onClick: onPaste,
      shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'paste') || ''),
    });
  }

  items.push({
    label: 'Delete',
    onClick: onDelete,
    danger: true,
    shortcut: formatHotkeyForDisplay(getKeyForAction('actions', 'deleteNode') || ''),
  });

  return { label: 'Edit', submenu: items };
}

/**
 * If spell-check surfaced suggestions for the clicked word, prepend them
 * to the menu with a separator. Used by both the workspace and feedback
 * tree menu builders.
 */
export function prependSpellItems(
  baseItems: ContextMenuItem[],
  spellItems: ContextMenuItem[] | null | undefined
): ContextMenuItem[] {
  if (!spellItems || spellItems.length === 0) return baseItems;
  return [
    ...spellItems,
    { separator: true, label: '', onClick: () => {} },
    ...baseItems,
  ];
}
