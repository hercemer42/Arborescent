import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSeparator } from './MenuSeparator';
import { useViewMenuState } from './hooks/useViewMenuState';
import { getKeyForAction } from '../../data/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';

export function ViewMenu() {
  const {
    hasActiveFile,
    blueprintModeEnabled,
    summaryModeEnabled,
    handleToggleBlueprintMode,
    handleToggleSummaryMode,
  } = useViewMenuState();

  return (
    <Menu id="view" label="View">
      <MenuItem
        label="Blueprint Mode"
        shortcut={formatHotkeyForDisplay(getKeyForAction('view', 'toggleBlueprintMode') || 'CmdOrCtrl+Shift+B')}
        checked={blueprintModeEnabled}
        onClick={handleToggleBlueprintMode}
        disabled={!hasActiveFile}
      />
      <MenuSeparator />
      <MenuItem
        label="Summary Mode"
        checked={summaryModeEnabled}
        onClick={handleToggleSummaryMode}
        disabled={!hasActiveFile}
      />
    </Menu>
  );
}
