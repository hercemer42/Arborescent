import {
  Plugin,
  PluginManifest,
  PluginContextMenuItem,
  PluginNodeIndicator,
  NodeContext,
} from '../shared/pluginInterface';
import { TreeNode } from '../../../src/shared/types';
import { logger } from '../../../src/renderer/services/logger';

/**
 * PluginProxy runs in the renderer process and forwards extension point calls
 * to the plugin running in the worker thread via IPC.
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
