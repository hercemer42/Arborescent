import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import crypto from 'node:crypto';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './handlers';
import { createApplicationMenu } from './services/menuService';
import { registerTerminalHandlers, cleanupTerminals } from './handlers/terminalHandlers';
import { logger } from './services/logger';
import { startHookServerWithRetry, HookServer } from './services/hookServer';
import { startMcpServerWithRetry, ArborescentMcpServer } from './services/mcpServer';
import { installHooks } from './services/hookInstaller';
import { createHookEventDispatcher } from './services/hookEventDispatcher';
import {
  createRebindIpcBridge,
  RebindIpcBridge,
  RebindDecisionListener,
  REBIND_REQUEST_CHANNEL,
  REBIND_CANCELLED_CHANNEL,
} from './services/rebindIpcBridge';
import {
  createMcpTreeReaderBridge,
  McpTreeReaderBridge,
  TreeReadResponse,
  TREE_READ_REQUEST_CHANNEL,
} from './services/mcpTreeReaderBridge';
import {
  createMcpTreeMutatorBridge,
  McpTreeMutatorBridge,
  TreeMutateResponse,
  TREE_MUTATE_REQUEST_CHANNEL,
} from './services/mcpTreeMutatorBridge';

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
let hookServerPort = 0;
let mcpServer: ArborescentMcpServer | null = null;
let mcpServerPort = 0;
let rebindBridge: RebindIpcBridge | null = null;
let treeReaderBridge: McpTreeReaderBridge | null = null;
let treeMutatorBridge: McpTreeMutatorBridge | null = null;

const DEFAULT_HOOK_PORT = 17832;
const DEFAULT_MCP_PORT = 17840;
// 5 minutes — long enough that a user walking away briefly does not lose their decision,
// short enough that a never-handled prompt does not block the registry indefinitely.
const REBIND_DECISION_TIMEOUT_MS = 5 * 60_000;
const TREE_READ_TIMEOUT_MS = 5_000;
const TREE_MUTATE_TIMEOUT_MS = 10_000;
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

  // Background servers and IPC handlers live for the app's lifetime, not the window's.
  // On macOS, createWindow re-runs when the dock icon is clicked after all windows closed
  // (app.on('activate')) — without this guard, ipcMain.handle would throw on the second
  // pass and a second MCP server would orphan the first.
  if (!mcpServer) {
    const mcpResult = await startMcpServerWithRetry(DEFAULT_MCP_PORT, mcpAuthToken);

    if (mcpResult.server) {
      mcpServer = mcpResult.server;
      mcpServerPort = mcpResult.port;
      logger.info(`MCP server started on port ${mcpResult.port}`, 'Main');

      const decisionListeners = new Set<RebindDecisionListener>();
      ipcMain.handle('mcp:respond-rebind', (_event, sessionId: string, confirmed: boolean) => {
        for (const listener of decisionListeners) {
          listener({ sessionId, confirmed });
        }
      });

      rebindBridge = createRebindIpcBridge({
        registry: mcpServer.getBindingRegistry(),
        sendToRenderer: (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        },
        notifyRendererCancelled: (sessionId) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(REBIND_CANCELLED_CHANNEL, sessionId);
          }
        },
        onRendererDecision: (listener) => {
          decisionListeners.add(listener);
          return () => decisionListeners.delete(listener);
        },
        timeoutMs: REBIND_DECISION_TIMEOUT_MS,
      });
      logger.info(`Rebind IPC bridge active on channel ${REBIND_REQUEST_CHANNEL}`, 'Main');

      const treeReadResponders = new Set<(response: TreeReadResponse) => void>();
      ipcMain.handle('mcp:tree-read-response', (_event, response: TreeReadResponse) => {
        for (const responder of treeReadResponders) responder(response);
      });

      treeReaderBridge = createMcpTreeReaderBridge({
        sendToRenderer: (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        },
        onRendererResponse: (handler) => {
          treeReadResponders.add(handler);
          return () => treeReadResponders.delete(handler);
        },
        timeoutMs: TREE_READ_TIMEOUT_MS,
      });
      mcpServer.attachReadTools(treeReaderBridge);
      logger.info(`MCP read tools attached on channel ${TREE_READ_REQUEST_CHANNEL}`, 'Main');

      const treeMutateResponders = new Set<(response: TreeMutateResponse) => void>();
      ipcMain.handle('mcp:tree-mutate-response', (_event, response: TreeMutateResponse) => {
        for (const responder of treeMutateResponders) responder(response);
      });

      treeMutatorBridge = createMcpTreeMutatorBridge({
        sendToRenderer: (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        },
        onRendererResponse: (handler) => {
          treeMutateResponders.add(handler);
          return () => treeMutateResponders.delete(handler);
        },
        timeoutMs: TREE_MUTATE_TIMEOUT_MS,
      });
      mcpServer.attachWriteTools(treeReaderBridge, treeMutatorBridge);
      logger.info(`MCP write tools attached on channel ${TREE_MUTATE_REQUEST_CHANNEL}`, 'Main');
    } else {
      logger.warn('MCP server failed to start — MCP tools will not be reachable from Claude Code', 'Main');
    }
  }

  if (!hookServer) {
    const dispatchHookEvent = createHookEventDispatcher({
      getMcpServer: () => mcpServer,
      forwardToRenderer: (payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hook-event', payload);
        }
      },
    });

    const hookResult = await startHookServerWithRetry(
      DEFAULT_HOOK_PORT,
      hookAuthToken,
      dispatchHookEvent,
    );

    if (hookResult.server) {
      hookServer = hookResult.server;
      hookServerPort = hookResult.port;
      logger.info(`Hook server started on port ${hookResult.port}`, 'Main');
    } else {
      logger.warn('Hook server failed to start — workflow hooks will not work', 'Main');
    }

    try {
      await installHooks({ userDataPath: app.getPath('userData') });
    } catch (error) {
      logger.error('Failed to install Claude Code hooks', error as Error, 'Main', undefined, false);
    }
  }

  const terminalEnv: Record<string, string> = {
    ...(hookServer ? {
      ARBORESCENT_HOOK_PORT: String(hookServerPort),
      ARBORESCENT_AUTH_TOKEN: hookAuthToken,
    } : {}),
    ...(mcpServer ? {
      ARBORESCENT_MCP_PORT: String(mcpServerPort),
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
  rebindBridge?.dispose();
  treeReaderBridge?.dispose();
  treeMutatorBridge?.dispose();
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
