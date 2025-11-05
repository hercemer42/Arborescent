import { TreeNode } from './treeNode';

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  enabled: boolean;
  builtin: boolean;
}

export interface NodeContext {
  hasAncestorSession: boolean;
}

export interface PluginContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: PluginContextMenuItem[];
}

export interface PluginNodeIndicator {
  type: 'text' | 'icon';
  value: string;
}

export interface PluginExtensionPoints {
  provideNodeContextMenuItems?(
    node: TreeNode,
    context: NodeContext
  ): PluginContextMenuItem[] | Promise<PluginContextMenuItem[]>;

  provideNodeIndicator?(
    node: TreeNode
  ): PluginNodeIndicator | null | Promise<PluginNodeIndicator | null>;
}

/**
 * Plugin interface defines the contract for all Arborescent plugins.
 *
 * Plugins must implement a constructor that accepts a PluginContext parameter:
 *   constructor(context: PluginContext)
 *
 * The PluginContext provides access to IPC handlers and other platform services.
 */
export interface Plugin {
  manifest: PluginManifest;

  initialize(): Promise<void>;
  dispose(): void;

  extensions: PluginExtensionPoints;
}

export interface PluginCommand {
  id: string;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
}
