import { AIPlugin, AISession, PluginManifest } from '../../../src/renderer/plugins/core/pluginInterface';
import { TreeNode } from '../../../src/shared/types';
import { ContextMenuItem } from '../../../src/renderer/components/ui/ContextMenu';
import { logger } from '../../../src/renderer/services/logger';
import manifest from './manifest.json';

interface ClaudePluginMetadata {
  sessionId?: string;
}

export class ClaudePlugin implements AIPlugin {
  manifest: PluginManifest = manifest;
  private projectPath: string = '';

  async initialize(): Promise<void> {
    this.projectPath = await window.electron.claudeGetProjectPath();
    logger.info(`Plugin initialized for project: ${this.projectPath}`, 'Claude Plugin');
  }

  dispose(): void {
    logger.info('Plugin disposed', 'Claude Plugin');
  }

  private getClaudeMetadata(node: TreeNode): ClaudePluginMetadata {
    return (node.metadata.plugins?.claude as ClaudePluginMetadata) || {};
  }

  async getSessions(): Promise<AISession[]> {
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
      logger.error('Failed to get Claude sessions', error as Error, 'Claude Plugin', false);
      return [];
    }
  }

  async sendToSession(sessionId: string, context: string): Promise<void> {
    try {
      await window.electron.claudeSendToSession(sessionId, context, this.projectPath);
    } catch (error) {
      logger.error('Failed to send context to Claude session', error as Error, 'Claude Plugin');
      throw error;
    }
  }

  getContextMenuItems(node: TreeNode, hasAncestorSession: boolean): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (hasAncestorSession) {
      return items;
    }

    const claudeData = this.getClaudeMetadata(node);

    if (claudeData.sessionId) {
      items.push({
        label: 'Send to Last Session',
        onClick: async () => {
          logger.info(`Send to last session: ${claudeData.sessionId}`, 'Claude Plugin');
        },
      });
    }

    items.push({
      label: 'Send to Session...',
      onClick: async () => {
        logger.info('Show session picker', 'Claude Plugin');
      },
    });

    return items;
  }

  getNodeIndicator(node: TreeNode): React.ReactNode | null {
    const claudeData = this.getClaudeMetadata(node);
    if (claudeData.sessionId) {
      return '🤖';
    }
    return null;
  }
}
