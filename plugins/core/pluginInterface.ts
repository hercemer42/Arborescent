import { TreeNode } from '../../src/shared/types';
import { ContextMenuItem } from '../../src/renderer/components/ui/ContextMenu';

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

export interface SidebarPanel {
  id: string;
  title: string;
  icon?: React.ReactNode;
  component: React.ComponentType;
}

export interface ToolbarAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

export interface PluginExtensionPoints {
  provideNodeContextMenuItems?(node: TreeNode, context: NodeContext): ContextMenuItem[];

  provideNodeIndicator?(node: TreeNode): React.ReactNode | null;

  provideSidebarPanels?(): SidebarPanel[];

  provideToolbarActions?(): ToolbarAction[];
}

export interface Plugin {
  manifest: PluginManifest;

  initialize(): Promise<void>;
  dispose(): void;

  extensions: PluginExtensionPoints;
}
