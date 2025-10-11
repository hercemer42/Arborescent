import { Menu, BrowserWindow } from 'electron';

export function createApplicationMenu(
  onOpen: () => void,
  onSave: () => void,
  onSaveAs: () => void
) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: onOpen,
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: onSave,
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: onSaveAs,
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.close();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
