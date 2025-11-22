import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSeparator } from './MenuSeparator';
import { useEditMenuState, useEditMenuActions } from './hooks';

export function EditMenu() {
  const { canUndo, canRedo, canCut, canCopy, canPaste, canDelete } = useEditMenuState();
  const { handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleDelete } =
    useEditMenuActions();

  return (
    <Menu id="edit" label="Edit">
      <MenuItem
        label="Undo"
        shortcut="Ctrl+Z"
        disabled={!canUndo}
        onClick={handleUndo}
      />
      <MenuItem
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        disabled={!canRedo}
        onClick={handleRedo}
      />
      <MenuSeparator />
      <MenuItem
        label="Cut"
        shortcut="Ctrl+X"
        disabled={!canCut}
        onClick={handleCut}
      />
      <MenuItem
        label="Copy"
        shortcut="Ctrl+C"
        disabled={!canCopy}
        onClick={handleCopy}
      />
      <MenuItem
        label="Paste"
        shortcut="Ctrl+V"
        disabled={!canPaste}
        onClick={handlePaste}
      />
      <MenuSeparator />
      <MenuItem
        label="Delete"
        shortcut="Del"
        disabled={!canDelete}
        onClick={handleDelete}
        danger
      />
    </Menu>
  );
}
