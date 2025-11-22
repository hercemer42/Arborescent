import { PLUGINS } from '../../plugins.config';
import { app } from 'electron';
import * as path from 'path';

/**
 * Dependencies that can be injected for testing
 */
export interface LoadHandlersDeps {
  getAppPath: () => string;
  requireModule: (path: string) => { registerIpcHandlers?: () => void; default?: { registerIpcHandlers?: () => void } };
}

// Default dependencies using real implementations
const defaultDeps: LoadHandlersDeps = {
  getAppPath: () => app.getAppPath(),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  requireModule: (modulePath: string) => require(modulePath),
};

/**
 * Dynamically loads plugin IPC handlers from built plugin bundles.
 *
 * Each plugin can register handlers in IPCBridge (the plugin API surface) by:
 * 1. Exporting a `registerIpcHandlers()` function from their main entry point
 * 2. Specifying `mainHandlersPath` in their plugin.config.ts
 *
 * This function imports each plugin's built bundle and calls registerIpcHandlers(),
 * which adds handlers to IPCBridge that plugins can then call via context.invokeIPC().
 *
 * Example flow:
 * - Claude Code plugin exports registerIpcHandlers() in Plugin.ts
 * - That function registers 'claude:list-sessions' handler in IPCBridge
 * - Plugin worker calls context.invokeIPC('claude:list-sessions')
 * - IPCBridge routes the call to that handler
 *
 * Note: Uses dynamic imports because plugin bundles are built separately and
 * loaded at runtime, not bundled with the main app.
 */
export async function loadPluginHandlers(deps: LoadHandlersDeps = defaultDeps): Promise<void> {
  for (const config of PLUGINS) {
    if (config.mainHandlersPath) {
      try {
        // Resolve path relative to app root
        const appPath = deps.getAppPath();
        const absolutePath = path.isAbsolute(config.mainHandlersPath)
          ? config.mainHandlersPath
          : path.resolve(appPath, config.mainHandlersPath);

        // Use require for CommonJS .cjs files
        const module = deps.requireModule(absolutePath);

        // Handle both CommonJS and ES module exports
        const registerFn = module.registerIpcHandlers || module.default?.registerIpcHandlers;
        if (registerFn) {
          registerFn();
          console.log(`[Plugin Handlers] Loaded handlers for: ${config.name}`);
        } else {
          console.warn(`[Plugin Handlers] No registerIpcHandlers found in: ${config.name}`);
        }
      } catch (error) {
        console.error(`[Plugin Handlers] Failed to load handlers for ${config.name}:`, error);
        // Don't throw - allow other plugins to load
      }
    }
  }
}
