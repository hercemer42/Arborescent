import { PLUGINS } from '../../plugins.config';

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
export async function loadPluginHandlers(): Promise<void> {
  for (const config of PLUGINS) {
    if (config.mainHandlersPath) {
      // Dynamic import requires vite-ignore since path is determined at runtime
      const module = await import(/* @vite-ignore */ config.mainHandlersPath);
      module.registerIpcHandlers();
    }
  }
}
