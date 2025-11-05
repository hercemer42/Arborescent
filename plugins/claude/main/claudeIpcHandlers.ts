import { ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, ChildProcess } from 'node:child_process';
import { logger } from '../../../src/main/services/logger';

interface ClaudeSession {
  id: string;
  projectPath: string;
  lastModified: Date;
  firstMessage: string;
}

function getClaudeProjectDirectory(projectPath: string): string {
  const homeDir = os.homedir();
  const claudeDir = path.join(homeDir, '.claude', 'projects');
  const encodedPath = projectPath.replace(/\//g, '-');
  return path.join(claudeDir, encodedPath);
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
): Promise<ClaudeSession> {
  const stats = await fs.stat(filePath);
  const sessionId = path.basename(filePath, '.jsonl');

  let firstMessage = '';
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const firstLine = JSON.parse(lines[0]);
      if (firstLine.message?.content) {
        firstMessage = firstLine.message.content.substring(0, 100);
      }
    }
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

async function readSessionFiles(projectDir: string, projectPath: string): Promise<ClaudeSession[]> {
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
    logger.error('Failed to spawn Claude process', error, 'Claude Plugin', true);
    reject(error);
  });

  claudeProcess.on('close', (code) => {
    if (code === 0) {
      logger.info(`Claude session ${sessionId} completed`, 'Claude Plugin');
      resolve();
    } else {
      const error = new Error(`Claude process exited with code ${code}`);
      logger.error('Claude process failed', error, 'Claude Plugin', true);
      reject(error);
    }
  });
}

export function registerClaudeIpcHandlers() {
  ipcMain.handle('claude:get-project-path', async () => {
    return process.cwd();
  });

  ipcMain.handle('claude:list-sessions', async (_, projectPath: string) => {
    try {
      const projectDir = getClaudeProjectDirectory(projectPath);
      const claudeBaseDir = path.dirname(projectDir);

      if (!(await directoryExists(claudeBaseDir))) {
        logger.info('Claude directory not found', 'Claude Plugin');
        return [];
      }

      if (!(await directoryExists(projectDir))) {
        logger.info(`No Claude sessions for project: ${projectPath}`, 'Claude Plugin');
        return [];
      }

      const sessions = await readSessionFiles(projectDir, projectPath);
      logger.info(`Found ${sessions.length} Claude sessions for project: ${projectPath}`, 'Claude Plugin');
      return sessions;
    } catch (error) {
      logger.error('Failed to list Claude sessions', error as Error, 'Claude Plugin', false);
      return [];
    }
  });

  ipcMain.handle('claude:send-to-session', async (_, sessionId: string, context: string, projectPath: string) => {
    try {
      logger.info(`Sending context to Claude session: ${sessionId}`, 'Claude Plugin');
      await spawnClaudeProcess(sessionId, context, projectPath);
    } catch (error) {
      logger.error('Failed to send context to Claude', error as Error, 'Claude Plugin', true);
      throw error;
    }
  });
}
