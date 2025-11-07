import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';
import { logger } from '../../../src/main/services/logger';
import { ClaudeCodeSession } from './types';
import { pluginIPCBridge } from '../../core/main/IPCBridge';

function getClaudeProjectDirectory(projectPath: string): string {
  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude', 'projects');
  const encodedPath = projectPath.replace(/\//g, '-');
  return path.join(claudeDir, encodedPath);
}

function extractSessionId(filePath: string): string {
  return path.basename(filePath, '.jsonl');
}

function parseFirstMessage(content: string): string {
  try {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const firstLine = JSON.parse(lines[0]);
      if (firstLine.message?.content) {
        return firstLine.message.content.substring(0, 100);
      }
    }
  } catch {
    return '';
  }
  return '';
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function parseSessionMetadata(
  filePath: string,
  projectPath: string
): Promise<ClaudeCodeSession> {
  const stats = await fs.stat(filePath);
  const sessionId = extractSessionId(filePath);

  let firstMessage = '';
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    firstMessage = parseFirstMessage(content);
  } catch {
    firstMessage = '';
  }

  return {
    id: sessionId,
    projectPath,
    lastModified: stats.mtime,
    firstMessage,
  };
}

async function readSessionFiles(projectDir: string, projectPath: string): Promise<ClaudeCodeSession[]> {
  const files = await fs.readdir(projectDir);
  const sessionFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('summary'));

  const sessions = await Promise.all(
    sessionFiles.map(async (file) => {
      const filePath = path.join(projectDir, file);
      return parseSessionMetadata(filePath, projectPath);
    })
  );

  sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return sessions;
}

function spawnClaudeProcess(
  sessionId: string,
  context: string,
  projectPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const claudeProcess = spawn('claude', ['--resume', sessionId, '-p', context], {
      cwd: projectPath,
      stdio: 'inherit',
    });

    handleClaudeProcessEvents(claudeProcess, sessionId, resolve, reject);
  });
}

function handleClaudeProcessEvents(
  claudeProcess: ChildProcess,
  sessionId: string,
  resolve: (value: void) => void,
  reject: (reason: Error) => void
): void {
  claudeProcess.on('error', (error) => {
    logger.error('Failed to spawn Claude process', error, 'Claude Code Plugin', true);
    reject(error);
  });

  claudeProcess.on('close', (code) => {
    if (code === 0) {
      logger.info(`Claude Code session ${sessionId} completed`, 'Claude Code Plugin');
      resolve();
    } else {
      const error = new Error(`Claude process exited with code ${code}`);
      logger.error('Claude process failed', error, 'Claude Code Plugin', true);
      reject(error);
    }
  });
}

export function registerClaudeCodeIpcHandlers() {
  const getProjectPathHandler = async () => {
    return process.cwd();
  };

  const listSessionsHandler = async (_: unknown, ...args: unknown[]) => {
    const projectPath = args[0] as string;
    try {
      const projectDir = getClaudeProjectDirectory(projectPath);
      const claudeBaseDir = path.dirname(projectDir);

      if (!(await directoryExists(claudeBaseDir))) {
        logger.info('Claude directory not found', 'Claude Code Plugin');
        return [];
      }

      if (!(await directoryExists(projectDir))) {
        logger.info(`No Claude Code sessions for project: ${projectPath}`, 'Claude Code Plugin');
        return [];
      }

      const sessions = await readSessionFiles(projectDir, projectPath);
      logger.info(`Found ${sessions.length} Claude Code sessions for project: ${projectPath}`, 'Claude Code Plugin');
      return sessions;
    } catch (error) {
      logger.error('Failed to list Claude Code sessions', error as Error, 'Claude Code Plugin', false);
      return [];
    }
  };

  const sendToSessionHandler = async (_: unknown, ...args: unknown[]) => {
    const sessionId = args[0] as string;
    const context = args[1] as string;
    const projectPath = args[2] as string;
    try {
      logger.info(`Sending context to Claude Code session: ${sessionId}`, 'Claude Code Plugin');
      await spawnClaudeProcess(sessionId, context, projectPath);
    } catch (error) {
      logger.error('Failed to send context to Claude Code session', error as Error, 'Claude Code Plugin', true);
      throw error;
    }
  };


  pluginIPCBridge.registerHandler('claude:get-project-path', getProjectPathHandler);
  pluginIPCBridge.registerHandler('claude:list-sessions', listSessionsHandler);
  pluginIPCBridge.registerHandler('claude:send-to-session', sendToSessionHandler);
}
