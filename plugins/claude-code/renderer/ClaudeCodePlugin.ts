import { Plugin, PluginManifest, NodeContext, PluginExtensionPoints } from '../../core/pluginInterface';
import { TreeNode } from '../../../src/shared/types';
import { ContextMenuItem } from '../../../src/renderer/components/ui/ContextMenu';
import { logger } from '../../../src/renderer/services/logger';
import manifest from './manifest.json';

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
    this.projectPath = await window.electron.claudeGetProjectPath();
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
      const sessions = await window.electron.claudeListSessions(this.projectPath);

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
      logger.error('Failed to get Claude Code sessions', error as Error, 'Claude Code Plugin', false);
      return [];
    }
  }

  async sendToSession(sessionId: string, context: string): Promise<void> {
    try {
      await window.electron.claudeSendToSession(sessionId, context, this.projectPath);
    } catch (error) {
      logger.error('Failed to send context to Claude Code session', error as Error, 'Claude Code Plugin');
      throw error;
    }
  }

  private getContextMenuItems(node: TreeNode, context: NodeContext): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (context.hasAncestorSession) {
      return items;
    }

    const claudeData = this.getClaudeMetadata(node);

    if (claudeData.sessionId) {
      items.push({
        label: 'Send to Last Session',
        onClick: async () => {
          logger.info(`Send to last session: ${claudeData.sessionId}`, 'Claude Code Plugin');
        },
      });
    }

    items.push({
      label: 'Send to Session...',
      onClick: async () => {
        logger.info('Show session picker', 'Claude Code Plugin');
      },
    });

    return items;
  }

  private getNodeIndicator(node: TreeNode): React.ReactNode | null {
    const claudeData = this.getClaudeMetadata(node);
    if (claudeData.sessionId) {
      return '🤖';
    }
    return null;
  }
}
