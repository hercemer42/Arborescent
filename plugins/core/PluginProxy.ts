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

  async provideNodeContextMenuItems(
    node: TreeNode,
    context: NodeContext
  ): Promise<PluginContextMenuItem[]> {
    try {
      const response = await window.electron.extensionHostInvokeExtension(
        this.pluginName,
        'provideNodeContextMenuItems',
        [node, context]
      );

      if (!response.success) {
        console.error(
          `Error invoking provideNodeContextMenuItems for ${this.pluginName}:`,
          response.error
        );
        return [];
      }

      return (response.result as { result?: PluginContextMenuItem[] })?.result || [];
    } catch (error) {
      console.error(
        `Error invoking provideNodeContextMenuItems for ${this.pluginName}:`,
        error
      );
      return [];
    }
  }

  async provideNodeIndicator(node: TreeNode): Promise<PluginNodeIndicator | null> {
    try {
      const response = await window.electron.extensionHostInvokeExtension(
        this.pluginName,
        'provideNodeIndicator',
        [node]
      );

      if (!response.success) {
        console.error(`Error invoking provideNodeIndicator for ${this.pluginName}:`, response.error);
        return null;
      }

      return (response.result as { result?: PluginNodeIndicator | null })?.result || null;
    } catch (error) {
      console.error(`Error invoking provideNodeIndicator for ${this.pluginName}:`, error);
      return null;
    }
  }

  async provideSidebarPanels(): Promise<PluginSidebarPanel[]> {
    try {
      const response = await window.electron.extensionHostInvokeExtension(
        this.pluginName,
        'provideSidebarPanels',
        []
      );

      if (!response.success) {
        console.error(`Error invoking provideSidebarPanels for ${this.pluginName}:`, response.error);
        return [];
      }

      return (response.result as { result?: PluginSidebarPanel[] })?.result || [];
    } catch (error) {
      console.error(`Error invoking provideSidebarPanels for ${this.pluginName}:`, error);
      return [];
    }
  }

  async provideToolbarActions(): Promise<PluginToolbarAction[]> {
    try {
      const response = await window.electron.extensionHostInvokeExtension(
        this.pluginName,
        'provideToolbarActions',
        []
      );

      if (!response.success) {
        console.error(`Error invoking provideToolbarActions for ${this.pluginName}:`, response.error);
        return [];
      }

      return (response.result as { result?: PluginToolbarAction[] })?.result || [];
    } catch (error) {
      console.error(`Error invoking provideToolbarActions for ${this.pluginName}:`, error);
      return [];
    }
  }
}
