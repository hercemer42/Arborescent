import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { MenuSeparator } from './MenuSeparator';
import { MenuSubmenu } from './MenuSubmenu';
import { useFileMenuState } from './hooks/useFileMenuState';
import { useFileMenuActions } from './hooks/useFileMenuActions';
import { getKeyForAction } from '../../data/hotkeyConfig';
import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';
import { usePreferencesStore } from '../../store/preferences/preferencesStore';
import { useUIStore } from '../../store/ui/uiStore';

export function FileMenu() {
  const { hasActiveFile, hasBlueprintNodes } = useFileMenuState();
  const {
    handleNew,
    handleOpen,
    handleImportBlueprint,
    handleExportBlueprint,
    handleSave,
    handleSaveAs,
    handleCloseTab,
    handleReload,
    handleQuit,
  } = useFileMenuActions();
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const openKeyboardShortcuts = useUIStore((state) => state.openKeyboardShortcuts);

  return (
    <Menu id="file" label="File">
      <MenuItem
        label="New"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'new') || 'CmdOrCtrl+N')}
        onClick={handleNew}
      />
      <MenuItem
        label="Open"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'open') || 'CmdOrCtrl+O')}
        onClick={handleOpen}
      />
      <MenuItem
        label="Import from Blueprint..."
        onClick={handleImportBlueprint}
      />
      <MenuItem
        label="Export as Blueprint..."
        onClick={handleExportBlueprint}
        disabled={!hasActiveFile || !hasBlueprintNodes}
      />
      <MenuSeparator />
      <MenuItem
        label="Save"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'save') || 'CmdOrCtrl+S')}
        disabled={!hasActiveFile}
        onClick={handleSave}
      />
      <MenuItem
        label="Save As"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'saveAs') || 'CmdOrCtrl+Shift+S')}
        disabled={!hasActiveFile}
        onClick={handleSaveAs}
      />
      <MenuSeparator />
      <MenuItem
        label="Close Tab"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'closeTab') || 'CmdOrCtrl+W')}
        disabled={!hasActiveFile}
        onClick={handleCloseTab}
      />
      <MenuSeparator />
      <MenuSubmenu label="Preferences">
        <MenuSubmenu label="Theme">
          <MenuItem
            label="Light"
            checked={theme === 'light'}
            onClick={() => setTheme('light')}
          />
          <MenuItem
            label="Dark"
            checked={theme === 'dark'}
            onClick={() => setTheme('dark')}
          />
        </MenuSubmenu>
        <MenuItem
          label="Keyboard Shortcuts..."
          onClick={openKeyboardShortcuts}
        />
      </MenuSubmenu>
      <MenuSeparator />
      <MenuItem
        label="Reload Application"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'reload') || 'CmdOrCtrl+R')}
        onClick={handleReload}
      />
      <MenuItem
        label="Quit"
        shortcut={formatHotkeyForDisplay(getKeyForAction('file', 'quit') || 'CmdOrCtrl+Q')}
        onClick={handleQuit}
      />
    </Menu>
  );
}
