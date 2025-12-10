import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './services/ipcService';
import { createApplicationMenu } from './services/menuService';
import { registerTerminalHandlers, cleanupTerminals } from './ipc/terminalHandlers';
import { logger } from './services/logger';

if (started) {
  app.quit();
}

// Separate userData paths for dev/prod to avoid conflicts
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  const userDataPath = app.getPath('userData');
  app.setPath('userData', `${userDataPath}-dev`);
  logger.info(`Using userData path: ${app.getPath('userData')}`, 'Main [Dev Mode]');
} else {
  logger.info(`Using userData path: ${app.getPath('userData')}`, 'Main [Production]');
}

let mainWindow: BrowserWindow | null = null;

const createWindow = async () => {
  await registerIpcHandlers(() => mainWindow);

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  createApplicationMenu();

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerTerminalHandlers(mainWindow);
};

app.on('ready', createWindow);

app.on('before-quit', () => {
  cleanupTerminals();
});

// macOS convention: keep app running until explicit Cmd+Q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
