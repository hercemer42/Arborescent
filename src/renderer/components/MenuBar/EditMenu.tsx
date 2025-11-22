import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSeparator } from './MenuSeparator';

export function EditMenu() {
  return (
    <Menu id="edit" label="Edit">
      <MenuItem label="Undo" shortcut="Ctrl+Z" disabled />
      <MenuItem label="Redo" shortcut="Ctrl+Shift+Z" disabled />
      <MenuSeparator />
      <MenuItem label="Cut" shortcut="Ctrl+X" disabled />
      <MenuItem label="Copy" shortcut="Ctrl+C" disabled />
      <MenuItem label="Paste" shortcut="Ctrl+V" disabled />
      <MenuSeparator />
      <MenuItem label="Delete" shortcut="Del" disabled />
    </Menu>
  );
}
