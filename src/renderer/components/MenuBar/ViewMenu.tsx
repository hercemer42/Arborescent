import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { useViewMenuState } from './hooks/useViewMenuState';
import { getKeyForAction } from '../../data/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';

export function ViewMenu() {
  const { hasActiveFile, blueprintModeEnabled, handleToggleBlueprintMode } = useViewMenuState();

  return (
    <Menu id="view" label="View">
      <MenuItem
        label="Blueprint Mode"
        shortcut={formatHotkeyForDisplay(getKeyForAction('view', 'toggleBlueprintMode') || 'CmdOrCtrl+Shift+B')}
        checked={blueprintModeEnabled}
        onClick={handleToggleBlueprintMode}
        disabled={!hasActiveFile}
      />
    </Menu>
  );
}
