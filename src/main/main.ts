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
import { getOrCreateMcpAuthToken } from './services/mcpAuthToken';
import { registerArborescentMcp } from './services/claudeMcpConfigInstaller';
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
import {
  createMcpStepOutputApplierBridge,
  McpStepOutputApplierBridge,
  StepOutputApplyResponse,
  STEP_OUTPUT_APPLY_REQUEST_CHANNEL,
} from './services/mcpStepOutputApplierBridge';
import {
  createMcpProposalBridge,
  McpProposalBridge,
  ProposalResponse,
  PROPOSAL_REQUEST_CHANNEL,
} from './services/mcpProposalBridge';
import {
  createSeedBindingsIpcBridge,
  SeedBindingsIpcBridge,
  SeedPair,
  SEED_BINDINGS_CHANNEL,
  CLEAR_BINDINGS_CHANNEL,
} from './services/seedBindingsIpcBridge';

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
let stepOutputApplierBridge: McpStepOutputApplierBridge | null = null;
let proposalBridge: McpProposalBridge | null = null;
let seedBindingsBridge: SeedBindingsIpcBridge | null = null;

const DEFAULT_HOOK_PORT = 17832;
const DEFAULT_MCP_PORT = 17840;
// 5 minutes — long enough that a user walking away briefly does not lose their decision,
// short enough that a never-handled prompt does not block the registry indefinitely.
const REBIND_DECISION_TIMEOUT_MS = 5 * 60_000;
const TREE_READ_TIMEOUT_MS = 5_000;
const TREE_MUTATE_TIMEOUT_MS = 10_000;
const STEP_OUTPUT_APPLY_TIMEOUT_MS = 10_000;
const PROPOSAL_SUBMIT_TIMEOUT_MS = 10_000;
const hookAuthToken = crypto.randomUUID();
let mcpAuthToken = '';

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
    mcpAuthToken = await getOrCreateMcpAuthToken(app.getPath('userData'));
    const mcpResult = await startMcpServerWithRetry(DEFAULT_MCP_PORT, mcpAuthToken);

    if (mcpResult.server) {
      mcpServer = mcpResult.server;
      mcpServerPort = mcpResult.port;
      logger.info(`MCP server started on port ${mcpResult.port}`, 'Main');

      try {
        await registerArborescentMcp({ port: mcpResult.port, token: mcpAuthToken });
        logger.info('Arborescent MCP server registered in ~/.claude.json', 'Main');
      } catch (error) {
        logger.error('Failed to register Arborescent MCP server in ~/.claude.json', error as Error, 'Main');
      }

      const decisionListeners = new Set<RebindDecisionListener>();
      ipcMain.handle('mcp:respond-rebind', (_event, sessionId: string, confirmed: boolean) => {
        for (const listener of decisionListeners) {
          listener({ sessionId, confirmed });
        }
      });

      rebindBridge = createRebindIpcBridge({
        registry: mcpServer.getBindingRegistry(),
        submitMarker: mcpServer.getSubmitMarker(),
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
      const proposalResponders = new Set<(response: ProposalResponse) => void>();
      ipcMain.handle('mcp:proposal-response', (_event, response: ProposalResponse) => {
        for (const responder of proposalResponders) responder(response);
      });

      proposalBridge = createMcpProposalBridge({
        sendToRenderer: (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        },
        onRendererResponse: (handler) => {
          proposalResponders.add(handler);
          return () => proposalResponders.delete(handler);
        },
        timeoutMs: PROPOSAL_SUBMIT_TIMEOUT_MS,
      });

      mcpServer.attachWriteTools(treeReaderBridge, treeMutatorBridge, proposalBridge);
      logger.info(`MCP write tools attached on channel ${TREE_MUTATE_REQUEST_CHANNEL}`, 'Main');

      const stepOutputResponders = new Set<(response: StepOutputApplyResponse) => void>();
      ipcMain.handle('mcp:step-output-apply-response', (_event, response: StepOutputApplyResponse) => {
        for (const responder of stepOutputResponders) responder(response);
      });

      stepOutputApplierBridge = createMcpStepOutputApplierBridge({
        sendToRenderer: (channel, payload) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, payload);
          }
        },
        onRendererResponse: (handler) => {
          stepOutputResponders.add(handler);
          return () => stepOutputResponders.delete(handler);
        },
        timeoutMs: STEP_OUTPUT_APPLY_TIMEOUT_MS,
      });
      mcpServer.attachSubmitOutputTool(treeReaderBridge, stepOutputApplierBridge, proposalBridge);
      logger.info(
        `MCP submit_step_output tool attached on channel ${STEP_OUTPUT_APPLY_REQUEST_CHANNEL}; proposal bridge on channel ${PROPOSAL_REQUEST_CHANNEL}`,
        'Main',
      );

      seedBindingsBridge = createSeedBindingsIpcBridge({
        registry: mcpServer.getBindingRegistry(),
      });
      ipcMain.handle(SEED_BINDINGS_CHANNEL, (_event, pairs: SeedPair[]) => {
        seedBindingsBridge?.seed(pairs);
      });
      ipcMain.handle(CLEAR_BINDINGS_CHANNEL, (_event, sessionIds: string[]) => {
        seedBindingsBridge?.clear(sessionIds);
      });
      logger.info(
        `Seed bindings IPC bridge active on channels ${SEED_BINDINGS_CHANNEL} / ${CLEAR_BINDINGS_CHANNEL}`,
        'Main',
      );
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
  stepOutputApplierBridge?.dispose();
  proposalBridge?.dispose();
  seedBindingsBridge?.dispose();
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
