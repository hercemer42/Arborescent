import {
  Plugin,
  PluginManifest,
  NodeContext,
  PluginExtensionPoints,
  PluginContextMenuItem,
  PluginNodeIndicator,
} from '../../core/pluginInterface';
import { TreeNode } from '../../../src/shared/types';
import manifest from '../renderer/manifest.json';

interface ClaudeCodePluginMetadata {
  sessionId?: string;
}

export interface ClaudeCodeSession {
  id: string;
  displayName: string;
  projectPath?: string;
  lastModified?: Date;
}

export class ClaudeCodePlugin implements Plugin {
  manifest: PluginManifest = manifest;
  private projectPath: string = '';

  extensions: PluginExtensionPoints = {
    provideNodeContextMenuItems: (node: TreeNode, context: NodeContext) => {
      return this.getContextMenuItems(node, context);
    },

    provideNodeIndicator: (node: TreeNode) => {
      return this.getNodeIndicator(node);
    },
  };

  async initialize(): Promise<void> {
    // Use pluginAPI to call IPC handlers from the extension host
    const api = (global as { pluginAPI: { invokeIPC: (channel: string, ...args: unknown[]) => Promise<unknown> } }).pluginAPI;
    this.projectPath = (await api.invokeIPC('claude:get-project-path')) as string;
    console.log(`[Claude Code Plugin] Plugin initialized for project: ${this.projectPath}`);
  }

  dispose(): void {
    console.log('[Claude Code Plugin] Plugin disposed');
  }

  private getClaudeMetadata(node: TreeNode): ClaudeCodePluginMetadata {
    return (node.metadata.plugins?.claude as ClaudeCodePluginMetadata) || {};
  }

  async getSessions(): Promise<ClaudeCodeSession[]> {
    try {
      const api = (global as { pluginAPI: { invokeIPC: (channel: string, ...args: unknown[]) => Promise<unknown> } }).pluginAPI;
      const sessions = (await api.invokeIPC(
        'claude:list-sessions',
        this.projectPath
      )) as unknown[];

      return sessions.map((s: unknown) => {
        const session = s as {
          id: string;
          projectPath?: string;
          lastModified: string;
          firstMessage?: string;
        };

        return {
          id: session.id,
          displayName: session.firstMessage || session.id.substring(0, 8),
          projectPath: session.projectPath,
          lastModified: new Date(session.lastModified),
        };
      });
    } catch (error) {
      console.error('[Claude Code Plugin] Failed to get Claude Code sessions:', error);
      return [];
    }
  }

  async sendToSession(sessionId: string, context: string): Promise<void> {
    try {
      const api = (global as { pluginAPI: { invokeIPC: (channel: string, ...args: unknown[]) => Promise<unknown> } }).pluginAPI;
      await api.invokeIPC(
        'claude:send-to-session',
        sessionId,
        context,
        this.projectPath
      );
    } catch (error) {
      console.error('[Claude Code Plugin] Failed to send context to Claude Code session:', error);
      throw error;
    }
  }

  private getContextMenuItems(node: TreeNode, context: NodeContext): PluginContextMenuItem[] {
    const items: PluginContextMenuItem[] = [];

    if (context.hasAncestorSession) {
      return items;
    }

    const claudeData = this.getClaudeMetadata(node);

    if (claudeData.sessionId) {
      items.push({
        id: 'claude-code:send-to-last-session',
        label: 'Send to Last Session',
      });
    }

    items.push({
      id: 'claude-code:send-to-session',
      label: 'Send to Session...',
    });

    return items;
  }

  private getNodeIndicator(node: TreeNode): PluginNodeIndicator | null {
    const claudeData = this.getClaudeMetadata(node);
    if (claudeData.sessionId) {
      return {
        type: 'text',
        value: '🤖',
      };
    }
    return null;
  }
}

export default ClaudeCodePlugin;
