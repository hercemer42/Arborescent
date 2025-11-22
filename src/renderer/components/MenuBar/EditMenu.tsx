import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSeparator } from './MenuSeparator';
import { useEditMenuState, useEditMenuActions } from './hooks';
import { getKeyForAction } from '../../data/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';

export function EditMenu() {
  const { canUndo, canRedo, canCut, canCopy, canPaste, canDelete } = useEditMenuState();
  const { handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleDelete } =
    useEditMenuActions();

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
