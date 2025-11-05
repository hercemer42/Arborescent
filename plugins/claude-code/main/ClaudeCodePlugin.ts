import {
  Plugin,
  PluginManifest,
  NodeContext,
  PluginExtensionPoints,
  PluginContextMenuItem,
  PluginNodeIndicator,
} from '../../core/pluginInterface';
import { PluginContext } from '../../core/main/extensionHost/PluginContext';
import { TreeNode } from '../../../src/shared/types';
import manifest from '../renderer/manifest.json';
import { logger } from '../../core/main/extensionHost/workerLogger';

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
  private context: PluginContext;
  private projectPath: string = '';

  constructor(context: PluginContext) {
    this.context = context;
  }

  extensions: PluginExtensionPoints = {
    provideNodeContextMenuItems: (node: TreeNode, context: NodeContext) => {
      return this.getContextMenuItems(node, context);
    },

    provideNodeIndicator: (node: TreeNode) => {
      return this.getNodeIndicator(node);
    },
  };

  async initialize(): Promise<void> {
    this.projectPath = await this.context.invokeIPC<string>('claude:get-project-path');
    logger.info(`Plugin initialized for project: ${this.projectPath}`, 'Claude Code Plugin');
  }

  dispose(): void {
    logger.info('Plugin disposed', 'Claude Code Plugin');
  }

  private getClaudeMetadata(node: TreeNode): ClaudeCodePluginMetadata {
    return (node.metadata.plugins?.claude as ClaudeCodePluginMetadata) || {};
  }

  async getSessions(): Promise<ClaudeCodeSession[]> {
    try {
      const sessions = await this.context.invokeIPC<unknown[]>(
        'claude:list-sessions',
        this.projectPath
      );

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
      logger.error('Failed to get Claude Code sessions', error as Error, 'Claude Code Plugin');
      return [];
    }
  }

  async sendToSession(sessionId: string, context: string): Promise<void> {
    try {
      await this.context.invokeIPC(
        'claude:send-to-session',
        sessionId,
        context,
        this.projectPath
      );
    } catch (error) {
      logger.error('Failed to send context to Claude Code session', error as Error, 'Claude Code Plugin');
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
