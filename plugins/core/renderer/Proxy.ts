import {
  Plugin,
  PluginManifest,
  PluginContextMenuItem,
  PluginNodeIndicator,
  NodeContext,
} from '../shared/interface';
import { TreeNode } from '../../../src/shared/types';
import { logger } from '../../../src/renderer/services/logger';

/**
 * PluginProxy is a renderer-side stub that forwards extension point calls to plugins
 * running in the worker thread via IPC.
 *
 * Architecture:
 * - Created by PluginManager during plugin registration
 * - Implements the Plugin interface locally in the renderer process
 * - Actual plugin code executes in an isolated worker thread
 * - All extension point calls are forwarded via window.electron.pluginInvokeExtension
 *
 * Lifecycle:
 * 1. PluginManager.registerPlugin() creates a PluginProxy instance
 * 2. UI components call extension point methods (e.g., provideNodeContextMenuItems)
 * 3. PluginProxy forwards the call to the worker via IPC
 * 4. Worker executes the plugin code and returns results
 * 5. PluginProxy returns results to the UI (or default values on error)
 *
 * Error Handling:
 * - Returns default values when plugin system isn't started
 * - Logs errors and returns defaults when plugins fail
 * - Gracefully handles worker communication failures
 */
export class PluginProxy implements Plugin {
  manifest: PluginManifest;
  extensionPoints = {
    provideNodeContextMenuItems: this.provideNodeContextMenuItems.bind(this),
    provideNodeIndicator: this.provideNodeIndicator.bind(this),
  };

  constructor(private pluginName: string, manifest: PluginManifest) {
    this.manifest = manifest;
  }

  async initialize(): Promise<void> {
    // Initialization happens in the worker thread
  }

  dispose(): void {
    // Disposal happens in the worker thread
  }

  private async invokeExtension<T>(
    extensionPoint: string,
    args: unknown[],
    defaultValue: T
  ): Promise<T> {
    try {
      const response = await window.electron.pluginInvokeExtension(
        this.pluginName,
        extensionPoint,
        args
      );

      if (!response.success) {
        if (response.error === 'Plugin system not started') {
          return defaultValue;
        }
        logger.error(
          `Error invoking ${extensionPoint} for ${this.pluginName}: ${response.error}`,
          undefined,
          'Plugin Proxy'
        );
        return defaultValue;
      }

      return (response.result as { result?: T })?.result ?? defaultValue;
    } catch (error) {
      logger.error(
        `Error invoking ${extensionPoint} for ${this.pluginName}`,
        error as Error,
        'Plugin Proxy'
      );
      return defaultValue;
    }
  }

  async provideNodeContextMenuItems(
    node: TreeNode,
    context: NodeContext
  ): Promise<PluginContextMenuItem[]> {
    return this.invokeExtension('provideNodeContextMenuItems', [node, context], []);
  }

  async provideNodeIndicator(node: TreeNode): Promise<PluginNodeIndicator | null> {
    return this.invokeExtension('provideNodeIndicator', [node], null);
  }
}
