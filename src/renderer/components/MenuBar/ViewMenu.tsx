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
    terminalOpen,
    browserOpen,
    feedbackOpen,
    handleToggleBlueprintMode,
    handleToggleSummaryMode,
    handleToggleTerminal,
    handleToggleBrowser,
    handleToggleFeedback,
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
      <MenuItem
        label="Summary Mode"
        shortcut={formatHotkeyForDisplay(getKeyForAction('view', 'toggleSummaryMode') || 'CmdOrCtrl+Shift+U')}
        checked={summaryModeEnabled}
        onClick={handleToggleSummaryMode}
        disabled={!hasActiveFile}
      />
      <MenuSeparator />
      <MenuItem
        label="Terminal"
        shortcut={formatHotkeyForDisplay(getKeyForAction('view', 'toggleTerminal') || 'CmdOrCtrl+`')}
        checked={terminalOpen}
        onClick={handleToggleTerminal}
      />
      <MenuItem
        label="Browser"
        shortcut={formatHotkeyForDisplay(getKeyForAction('view', 'toggleBrowser') || 'CmdOrCtrl+B')}
        checked={browserOpen}
        onClick={handleToggleBrowser}
      />
      <MenuItem
        label="Review"
        shortcut={formatHotkeyForDisplay(getKeyForAction('view', 'toggleFeedback') || 'CmdOrCtrl+Shift+F')}
        checked={feedbackOpen}
        onClick={handleToggleFeedback}
      />
    </Menu>
  );
}
