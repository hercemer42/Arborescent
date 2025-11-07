import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Menu, BrowserWindow } from 'electron';
import { createApplicationMenu } from '../menuService';

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(),
  },
}));

describe('menuService', () => {
  let onNew: ReturnType<typeof vi.fn>;
  let onOpen: ReturnType<typeof vi.fn>;
  let onSave: ReturnType<typeof vi.fn>;
  let onSaveAs: ReturnType<typeof vi.fn>;
  let mockMenu: unknown;
  let mockWindow: {
    reload: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    onNew = vi.fn();
    onOpen = vi.fn();
    onSave = vi.fn();
    onSaveAs = vi.fn();

    mockMenu = {};
    mockWindow = {
      reload: vi.fn(),
      close: vi.fn(),
    };

    vi.mocked(Menu.buildFromTemplate).mockReturnValue(mockMenu as Electron.Menu);
  });

  describe('createApplicationMenu', () => {
    it('should create menu with File submenu', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'File',
            submenu: expect.any(Array),
          }),
        ])
      );
    });

    it('should set the created menu as application menu', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      expect(Menu.setApplicationMenu).toHaveBeenCalledWith(mockMenu);
    });

    it('should include New menu item with correct accelerator', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const newItem = submenu.find(item => item.label === 'New');

      expect(newItem).toEqual(
        expect.objectContaining({
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: onNew,
        })
      );
    });

    it('should include Open menu item with correct accelerator', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const openItem = submenu.find(item => item.label === 'Open');

      expect(openItem).toEqual(
        expect.objectContaining({
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: onOpen,
        })
      );
    });

    it('should include Save menu item with correct accelerator', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const saveItem = submenu.find(item => item.label === 'Save');

      expect(saveItem).toEqual(
        expect.objectContaining({
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: onSave,
        })
      );
    });

    it('should include Save As menu item with correct accelerator', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const saveAsItem = submenu.find(item => item.label === 'Save As');

      expect(saveAsItem).toEqual(
        expect.objectContaining({
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: onSaveAs,
        })
      );
    });

    it('should include Reload Application menu item', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const reloadItem = submenu.find(item => item.label === 'Reload Application');

      expect(reloadItem).toEqual(
        expect.objectContaining({
          label: 'Reload Application',
          accelerator: 'CmdOrCtrl+R',
          click: expect.any(Function),
        })
      );
    });

    it('should reload window when Reload Application is clicked', () => {
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWindow as unknown as BrowserWindow);

      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const reloadItem = submenu.find(item => item.label === 'Reload Application');

      reloadItem?.click?.(
        {} as Electron.MenuItem,
        mockWindow as unknown as BrowserWindow,
        {} as Electron.KeyboardEvent
      );

      expect(mockWindow.reload).toHaveBeenCalled();
    });

    it('should not throw when reloading without focused window', () => {
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null);

      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const reloadItem = submenu.find(item => item.label === 'Reload Application');

      expect(() =>
        reloadItem?.click?.(
          {} as Electron.MenuItem,
          null as unknown as BrowserWindow,
          {} as Electron.KeyboardEvent
        )
      ).not.toThrow();
    });

    it('should include Quit menu item', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const quitItem = submenu.find(item => item.label === 'Quit');

      expect(quitItem).toEqual(
        expect.objectContaining({
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: expect.any(Function),
        })
      );
    });

    it('should close window when Quit is clicked', () => {
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWindow as unknown as BrowserWindow);

      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const quitItem = submenu.find(item => item.label === 'Quit');

      quitItem?.click?.(
        {} as Electron.MenuItem,
        mockWindow as unknown as BrowserWindow,
        {} as Electron.KeyboardEvent
      );

      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should not throw when quitting without focused window', () => {
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null);

      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const quitItem = submenu.find(item => item.label === 'Quit');

      expect(() =>
        quitItem?.click?.(
          {} as Electron.MenuItem,
          null as unknown as BrowserWindow,
          {} as Electron.KeyboardEvent
        )
      ).not.toThrow();
    });

    it('should include separators in submenu', () => {
      createApplicationMenu(onNew, onOpen, onSave, onSaveAs);

      const template = vi.mocked(Menu.buildFromTemplate).mock.calls[0][0];
      const fileMenu = template.find(item => item.label === 'File');
      const submenu = fileMenu?.submenu as Electron.MenuItemConstructorOptions[];
      const separators = submenu.filter(item => item.type === 'separator');

      expect(separators).toHaveLength(3);
    });
  });
});
