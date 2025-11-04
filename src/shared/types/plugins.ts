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

export interface PluginSidebarPanel {
  id: string;
  title: string;
  icon?: string;
  componentId: string;
}

export interface PluginToolbarAction {
  id: string;
  label: string;
  icon?: string;
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

  provideSidebarPanels?(): PluginSidebarPanel[] | Promise<PluginSidebarPanel[]>;

  provideToolbarActions?(): PluginToolbarAction[] | Promise<PluginToolbarAction[]>;
}

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
