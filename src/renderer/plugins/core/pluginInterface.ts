import { TreeNode } from '../../../shared/types';
import { ContextMenuItem } from '../../components/ui/ContextMenu';

export interface AISession {
  id: string;
  displayName: string;
  projectPath?: string;
  lastModified?: Date;
}

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  enabled: boolean;
  builtin: boolean;
}

export interface AIPlugin {
  manifest: PluginManifest;

  initialize(): Promise<void>;
  dispose(): void;

  getSessions(): Promise<AISession[]>;
  sendToSession(sessionId: string, context: string): Promise<void>;

  getContextMenuItems(node: TreeNode, hasAncestorSession: boolean): ContextMenuItem[];

  getNodeIndicator?(node: TreeNode): React.ReactNode | null;
}
