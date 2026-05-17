import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './handlers';
import { createApplicationMenu } from './services/menuService';
import { registerTerminalHandlers, cleanupTerminals } from './handlers/terminalHandlers';
import { logger } from './services/logger';
import { startHookServerWithRetry, HookServer } from './services/hookServer';
import { startMcpServerWithRetry, ArborescentMcpServer } from './services/mcpServer';

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
let hookServer: HookServer | null = null;
let mcpServer: ArborescentMcpServer | null = null;

const DEFAULT_HOOK_PORT = 17832;
const DEFAULT_MCP_PORT = 17840;
const hookAuthToken = crypto.randomUUID();
const mcpAuthToken = crypto.randomUUID();

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
      spellcheck: true,
    },
  });

  const availableLangs = mainWindow.webContents.session.availableSpellCheckerLanguages;
  const preferredLangs = app.getPreferredSystemLanguages();
  const langsToSet = preferredLangs.filter(lang => availableLangs.includes(lang));

  if (langsToSet.length > 0) {
    mainWindow.webContents.session.setSpellCheckerLanguages(langsToSet);
    logger.info(`[Spellcheck] Languages: ${langsToSet.join(', ')}`, 'Main');
  } else {
    logger.warn(`[Spellcheck] No matching dictionaries for preferred languages: ${preferredLangs.join(', ')}`, 'Main');
  }

  createApplicationMenu();

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
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

  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();

    mainWindow?.webContents.send('context-menu-params', {
      x: params.x,
      y: params.y,
      misspelledWord: params.misspelledWord || null,
      suggestions: params.dictionarySuggestions || [],
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const hookResult = await startHookServerWithRetry(
    DEFAULT_HOOK_PORT,
    hookAuthToken,
    (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hook-event', payload);
      }
    }
  );

  if (hookResult.server) {
    hookServer = hookResult.server;
    logger.info(`Hook server started on port ${hookResult.port}`, 'Main');
  } else {
    logger.warn('Hook server failed to start — workflow hooks will not work', 'Main');
  }

  const mcpResult = await startMcpServerWithRetry(DEFAULT_MCP_PORT, mcpAuthToken);

  if (mcpResult.server) {
    mcpServer = mcpResult.server;
    logger.info(`MCP server started on port ${mcpResult.port}`, 'Main');
  } else {
    logger.warn('MCP server failed to start — MCP tools will not be reachable from Claude Code', 'Main');
  }

  const terminalEnv: Record<string, string> = {
    ...(hookServer ? {
      ARBORESCENT_HOOK_PORT: String(hookResult.port),
      ARBORESCENT_AUTH_TOKEN: hookAuthToken,
    } : {}),
    ...(mcpServer ? {
      ARBORESCENT_MCP_PORT: String(mcpResult.port),
      ARBORESCENT_MCP_TOKEN: mcpAuthToken,
    } : {}),
  };

  registerTerminalHandlers(mainWindow, terminalEnv);
};

app.on('ready', createWindow);

// Handle keyboard shortcuts for webview contents (browser panel)
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.on('before-input-event', (event, input) => {
      // Ctrl+W or Cmd+W to close browser tab
      if ((input.control || input.meta) && input.key.toLowerCase() === 'w') {
        event.preventDefault();
        mainWindow?.webContents.send('close-browser-tab');
      }
    });
  }
});

app.on('before-quit', () => {
  void cleanupTerminals();
  void hookServer?.stop();
  void mcpServer?.stop();
});

// macOS convention: keep app running until explicit Cmd+Q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
