import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSeparator } from './MenuSeparator';
import { useEditMenuState, useEditMenuActions } from './hooks';
import { getKeyForAction } from '../../data/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';
import { useSearchStore } from '../../store/search/searchStore';

export function EditMenu() {
  const {
    canUndo,
    canRedo,
    canCut,
    canCopy,
    canPaste,
    canDelete,
    canToggleStatus,
    canIndent,
    canOutdent,
    canSelectAll,
  } = useEditMenuState();
  const {
    handleUndo,
    handleRedo,
    handleCut,
    handleCopy,
    handlePaste,
    handleDelete,
    handleToggleStatus,
    handleIndent,
    handleOutdent,
    handleSelectAll,
  } = useEditMenuActions();
  const openSearch = useSearchStore((state) => state.openSearch);

  return (
    <Menu id="edit" label="Edit">
      <MenuItem
        label="Undo"
        shortcut={formatHotkeyForDisplay(getKeyForAction('actions', 'undo') || 'CmdOrCtrl+Z')}
        disabled={!canUndo}
        onClick={handleUndo}
      />
      <MenuItem
        label="Redo"
        shortcut={formatHotkeyForDisplay(
          getKeyForAction('actions', 'redo') || 'CmdOrCtrl+Shift+Z'
        )}
        disabled={!canRedo}
        onClick={handleRedo}
      />
      <MenuSeparator />
      <MenuItem
        label="Cut"
        shortcut={formatHotkeyForDisplay('CmdOrCtrl+X')}
        disabled={!canCut}
        onClick={handleCut}
      />
      <MenuItem
        label="Copy"
        shortcut={formatHotkeyForDisplay('CmdOrCtrl+C')}
        disabled={!canCopy}
        onClick={handleCopy}
      />
      <MenuItem
        label="Paste"
        shortcut={formatHotkeyForDisplay('CmdOrCtrl+V')}
        disabled={!canPaste}
        onClick={handlePaste}
      />
      <MenuSeparator />
      <MenuItem
        label="Toggle Task Status"
        shortcut={formatHotkeyForDisplay(
          getKeyForAction('actions', 'toggleTaskStatus') || 'CmdOrCtrl+K'
        )}
        disabled={!canToggleStatus}
        onClick={handleToggleStatus}
      />
      <MenuSeparator />
      <MenuItem
        label="Indent"
        shortcut={formatHotkeyForDisplay(getKeyForAction('editing', 'indent') || 'Tab')}
        disabled={!canIndent}
        onClick={handleIndent}
      />
      <MenuItem
        label="Outdent"
        shortcut={formatHotkeyForDisplay(getKeyForAction('editing', 'outdent') || 'Shift+Tab')}
        disabled={!canOutdent}
        onClick={handleOutdent}
      />
      <MenuSeparator />
      <MenuItem
        label="Select All Nodes"
        shortcut={formatHotkeyForDisplay(
          getKeyForAction('actions', 'selectAll') || 'CmdOrCtrl+Shift+A'
        )}
        disabled={!canSelectAll}
        onClick={handleSelectAll}
      />
      <MenuSeparator />
      <MenuItem
        label="Find"
        shortcut={formatHotkeyForDisplay(getKeyForAction('search', 'openSearch') || 'CmdOrCtrl+F')}
        onClick={openSearch}
      />
      <MenuSeparator />
      <MenuItem
        label="Delete"
        shortcut={formatHotkeyForDisplay(
          getKeyForAction('actions', 'deleteNode') || 'CmdOrCtrl+D'
        )}
        disabled={!canDelete}
        onClick={handleDelete}
        danger
      />
    </Menu>
  );
}
