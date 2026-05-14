import { Menu, app, MenuItemConstructorOptions } from 'electron';
import { openLogFile } from './logger';

function buildHelpSubmenu(): MenuItemConstructorOptions {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'Open Log File',
        click: () => {
          void openLogFile();
        },
      },
    ],
  };
}

export function createApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(buildHelpSubmenu());

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
