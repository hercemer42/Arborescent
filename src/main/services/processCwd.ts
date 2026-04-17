import { execFile } from 'child_process';
import { readlink } from 'fs/promises';
import { logger } from './logger';

export interface ProcessCwdReader {
  read(pid: number): Promise<string | null>;
}

function execFileAsync(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 2000 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function readCwdDarwin(pid: number): Promise<string | null> {
  const stdout = await execFileAsync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn']);
  const line = stdout.split('\n').find((l) => l.startsWith('n'));
  return line ? line.slice(1) : null;
}

async function readCwdLinux(pid: number): Promise<string | null> {
  return await readlink(`/proc/${pid}/cwd`);
}

export const processCwdReader: ProcessCwdReader = {
  async read(pid: number): Promise<string | null> {
    try {
      if (process.platform === 'darwin') return await readCwdDarwin(pid);
      if (process.platform === 'linux') return await readCwdLinux(pid);
      return null;
    } catch (error) {
      logger.warn(`Failed to read cwd for pid ${pid}: ${(error as Error).message}`, 'ProcessCwd');
      return null;
    }
  },
};
