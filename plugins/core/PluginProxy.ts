import {
  Plugin,
  PluginManifest,
  PluginContextMenuItem,
  PluginNodeIndicator,
  PluginSidebarPanel,
  PluginToolbarAction,
  NodeContext,
} from './pluginInterface';
import { TreeNode } from '../../src/shared/types';

/**
 * PluginProxy runs in the renderer process and forwards extension point calls
 * to the plugin running in the worker thread via IPC.
 */
export class PluginProxy implements Plugin {
  manifest: PluginManifest;
  extensions = {
    provideNodeContextMenuItems: this.provideNodeContextMenuItems.bind(this),
    provideNodeIndicator: this.provideNodeIndicator.bind(this),
    provideSidebarPanels: this.provideSidebarPanels.bind(this),
    provideToolbarActions: this.provideToolbarActions.bind(this),
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
      const response = await window.electron.extensionHostInvokeExtension(
        this.pluginName,
        extensionPoint,
        args
      );

      if (!response.success) {
        if (response.error === 'Extension host not started') {
          return defaultValue;
        }
        console.error(`Error invoking ${extensionPoint} for ${this.pluginName}:`, response.error);
        return defaultValue;
      }

      return (response.result as { result?: T })?.result ?? defaultValue;
    } catch (error) {
      console.error(`Error invoking ${extensionPoint} for ${this.pluginName}:`, error);
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

  async provideSidebarPanels(): Promise<PluginSidebarPanel[]> {
    return this.invokeExtension('provideSidebarPanels', [], []);
  }

  async provideToolbarActions(): Promise<PluginToolbarAction[]> {
    return this.invokeExtension('provideToolbarActions', [], []);
  }
}
