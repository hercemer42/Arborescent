import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from '../MenuBar';
import { FileMenu } from '../FileMenu';
import { useMenuBarStore } from '../store';
import * as useFileMenuStateModule from '../hooks/useFileMenuState';
import * as useFileMenuActionsModule from '../hooks/useFileMenuActions';
import * as hotkeyConfigModule from '../../../data/hotkeyConfig';
import * as hotkeyUtilsModule from '../../../utils/hotkeyUtils';

// Mock dependencies
vi.mock('../hooks/useFileMenuState', () => ({
  useFileMenuState: vi.fn(),
}));

vi.mock('../hooks/useFileMenuActions', () => ({
  useFileMenuActions: vi.fn(),
}));

vi.mock('../../../data/hotkeyConfig', () => ({
  getKeyForAction: vi.fn(),
}));

vi.mock('../../../utils/hotkeyUtils', () => ({
  formatHotkeyForDisplay: vi.fn((key) => key),
}));

describe('FileMenu', () => {
  const mockUseFileMenuState = vi.mocked(useFileMenuStateModule.useFileMenuState);
  const mockUseFileMenuActions = vi.mocked(useFileMenuActionsModule.useFileMenuActions);
  const mockGetKeyForAction = vi.mocked(hotkeyConfigModule.getKeyForAction);
  const mockFormatHotkeyForDisplay = vi.mocked(hotkeyUtilsModule.formatHotkeyForDisplay);

  const defaultActions = {
    handleNew: vi.fn(),
    handleOpen: vi.fn(),
    handleSave: vi.fn(),
    handleSaveAs: vi.fn(),
    handleCloseTab: vi.fn(),
    handleReload: vi.fn(),
    handleQuit: vi.fn(),
  };

  function renderFileMenu() {
    useMenuBarStore.setState({ openMenuId: 'file' });
    return render(
      <MenuBar>
        <FileMenu />
      </MenuBar>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useMenuBarStore.setState({ openMenuId: null });

    // Default mocks
    mockUseFileMenuState.mockReturnValue({ hasActiveFile: true });
    mockUseFileMenuActions.mockReturnValue(defaultActions);
    mockGetKeyForAction.mockImplementation((context, action) => {
      const keys: Record<string, string> = {
        new: 'CmdOrCtrl+N',
        open: 'CmdOrCtrl+O',
        save: 'CmdOrCtrl+S',
        saveAs: 'CmdOrCtrl+Shift+S',
        closeTab: 'CmdOrCtrl+W',
        reload: 'CmdOrCtrl+R',
        quit: 'CmdOrCtrl+Q',
      };
      return keys[action];
    });
    mockFormatHotkeyForDisplay.mockImplementation((key) => key || '');
  });

  describe('rendering', () => {
    it('should render File menu button', () => {
      render(
        <MenuBar>
          <FileMenu />
        </MenuBar>
      );

      expect(screen.getByText('File')).toBeDefined();
    });

    it('should render all menu items when menu is open', () => {
      renderFileMenu();

      expect(screen.getByText('New')).toBeDefined();
      expect(screen.getByText('Open')).toBeDefined();
      expect(screen.getByText('Save')).toBeDefined();
      expect(screen.getByText('Save As')).toBeDefined();
      expect(screen.getByText('Close Tab')).toBeDefined();
      expect(screen.getByText('Reload Application')).toBeDefined();
      expect(screen.getByText('Quit')).toBeDefined();
    });

    it('should render shortcuts for all menu items', () => {
      renderFileMenu();

      expect(screen.getByText('CmdOrCtrl+N')).toBeDefined();
      expect(screen.getByText('CmdOrCtrl+O')).toBeDefined();
      expect(screen.getByText('CmdOrCtrl+S')).toBeDefined();
      expect(screen.getByText('CmdOrCtrl+Shift+S')).toBeDefined();
      expect(screen.getByText('CmdOrCtrl+W')).toBeDefined();
      expect(screen.getByText('CmdOrCtrl+R')).toBeDefined();
      expect(screen.getByText('CmdOrCtrl+Q')).toBeDefined();
    });

    it('should have separators between menu item groups', () => {
      const { container } = renderFileMenu();

      const separators = container.querySelectorAll('.menu-separator');
      expect(separators.length).toBe(3); // After Open, after Save As, after Close Tab
    });
  });

  describe('disabled state', () => {
    it('should disable Save when no active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const saveItem = screen.getByText('Save').closest('button');
      expect(saveItem).toHaveProperty('disabled', true);
    });

    it('should disable Save As when no active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const saveAsItem = screen.getByText('Save As').closest('button');
      expect(saveAsItem).toHaveProperty('disabled', true);
    });

    it('should disable Close Tab when no active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const closeTabItem = screen.getByText('Close Tab').closest('button');
      expect(closeTabItem).toHaveProperty('disabled', true);
    });

    it('should enable Save, Save As, Close Tab when active file exists', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: true });
      renderFileMenu();

      const saveItem = screen.getByText('Save').closest('button');
      const saveAsItem = screen.getByText('Save As').closest('button');
      const closeTabItem = screen.getByText('Close Tab').closest('button');

      expect(saveItem).toHaveProperty('disabled', false);
      expect(saveAsItem).toHaveProperty('disabled', false);
      expect(closeTabItem).toHaveProperty('disabled', false);
    });

    it('should always enable New regardless of active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const newItem = screen.getByText('New').closest('button');
      expect(newItem).toHaveProperty('disabled', false);
    });

    it('should always enable Open regardless of active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const openItem = screen.getByText('Open').closest('button');
      expect(openItem).toHaveProperty('disabled', false);
    });

    it('should always enable Reload Application regardless of active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const reloadItem = screen.getByText('Reload Application').closest('button');
      expect(reloadItem).toHaveProperty('disabled', false);
    });

    it('should always enable Quit regardless of active file', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const quitItem = screen.getByText('Quit').closest('button');
      expect(quitItem).toHaveProperty('disabled', false);
    });
  });

  describe('click handlers', () => {
    it('should call handleNew when New is clicked', () => {
      renderFileMenu();

      const newItem = screen.getByText('New');
      fireEvent.click(newItem);

      expect(defaultActions.handleNew).toHaveBeenCalledTimes(1);
    });

    it('should call handleOpen when Open is clicked', () => {
      renderFileMenu();

      const openItem = screen.getByText('Open');
      fireEvent.click(openItem);

      expect(defaultActions.handleOpen).toHaveBeenCalledTimes(1);
    });

    it('should call handleSave when Save is clicked', () => {
      renderFileMenu();

      const saveItem = screen.getByText('Save');
      fireEvent.click(saveItem);

      expect(defaultActions.handleSave).toHaveBeenCalledTimes(1);
    });

    it('should call handleSaveAs when Save As is clicked', () => {
      renderFileMenu();

      const saveAsItem = screen.getByText('Save As');
      fireEvent.click(saveAsItem);

      expect(defaultActions.handleSaveAs).toHaveBeenCalledTimes(1);
    });

    it('should call handleCloseTab when Close Tab is clicked', () => {
      renderFileMenu();

      const closeTabItem = screen.getByText('Close Tab');
      fireEvent.click(closeTabItem);

      expect(defaultActions.handleCloseTab).toHaveBeenCalledTimes(1);
    });

    it('should call handleReload when Reload Application is clicked', () => {
      renderFileMenu();

      const reloadItem = screen.getByText('Reload Application');
      fireEvent.click(reloadItem);

      expect(defaultActions.handleReload).toHaveBeenCalledTimes(1);
    });

    it('should call handleQuit when Quit is clicked', () => {
      renderFileMenu();

      const quitItem = screen.getByText('Quit');
      fireEvent.click(quitItem);

      expect(defaultActions.handleQuit).toHaveBeenCalledTimes(1);
    });

    it('should not call handleSave when Save is disabled and clicked', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const saveItem = screen.getByText('Save');
      fireEvent.click(saveItem);

      expect(defaultActions.handleSave).not.toHaveBeenCalled();
    });

    it('should not call handleSaveAs when Save As is disabled and clicked', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const saveAsItem = screen.getByText('Save As');
      fireEvent.click(saveAsItem);

      expect(defaultActions.handleSaveAs).not.toHaveBeenCalled();
    });

    it('should not call handleCloseTab when Close Tab is disabled and clicked', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();

      const closeTabItem = screen.getByText('Close Tab');
      fireEvent.click(closeTabItem);

      expect(defaultActions.handleCloseTab).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interaction', () => {
    it('should trigger handleNew on Enter key', () => {
      renderFileMenu();

      const newItem = screen.getByText('New').closest('button');
      fireEvent.keyDown(newItem!, { key: 'Enter' });

      expect(defaultActions.handleNew).toHaveBeenCalledTimes(1);
    });

    it('should trigger handleNew on Space key', () => {
      renderFileMenu();

      const newItem = screen.getByText('New').closest('button');
      fireEvent.keyDown(newItem!, { key: ' ' });

      expect(defaultActions.handleNew).toHaveBeenCalledTimes(1);
    });
  });

  describe('menu closing', () => {
    it('should close menu when menu item is clicked', () => {
      renderFileMenu();
      expect(useMenuBarStore.getState().openMenuId).toBe('file');

      const newItem = screen.getByText('New');
      fireEvent.click(newItem);

      expect(useMenuBarStore.getState().openMenuId).toBeNull();
    });

    it('should not close menu when disabled item is clicked', () => {
      mockUseFileMenuState.mockReturnValue({ hasActiveFile: false });
      renderFileMenu();
      expect(useMenuBarStore.getState().openMenuId).toBe('file');

      const saveItem = screen.getByText('Save');
      fireEvent.click(saveItem);

      expect(useMenuBarStore.getState().openMenuId).toBe('file');
    });
  });

  describe('hotkey fallbacks', () => {
    it('should use fallback when getKeyForAction returns undefined', () => {
      mockGetKeyForAction.mockReturnValue(undefined);
      renderFileMenu();

      // Fallback for New is CmdOrCtrl+N
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+N');
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+O');
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+S');
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+Shift+S');
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+W');
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+R');
      expect(mockFormatHotkeyForDisplay).toHaveBeenCalledWith('CmdOrCtrl+Q');
    });
  });
});
