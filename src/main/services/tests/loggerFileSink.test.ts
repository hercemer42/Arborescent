import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

import { logger, setElectronModule, openLogFile, getLogFilePath } from '../logger';

const FAKE_USER_DATA = path.join(os.tmpdir(), 'arborescent-logger-test');

function makeElectronMock(opts: {
  shellOpen?: ReturnType<typeof vi.fn>;
  userData?: string;
} = {}) {
  return {
    app: {
      getPath: vi.fn((key: string) => {
        if (key === 'userData') return opts.userData ?? FAKE_USER_DATA;
        return '';
      }),
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => []),
    },
    shell: {
      openPath: opts.shellOpen ?? vi.fn(() => Promise.resolve('')),
      showItemInFolder: vi.fn(),
    },
  } as unknown as typeof import('electron');
}

describe('main logger file sink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    if (fs.existsSync(FAKE_USER_DATA)) {
      fs.rmSync(FAKE_USER_DATA, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    setElectronModule(null);
    if (fs.existsSync(FAKE_USER_DATA)) {
      fs.rmSync(FAKE_USER_DATA, { recursive: true, force: true });
    }
  });

  describe('on-disk persistence', () => {
    it('writes log entries to userData/logs/arborescent.log', () => {
      setElectronModule(makeElectronMock());

      logger.info('persistence smoke test', 'WorkflowExecution');

      const expectedPath = path.join(FAKE_USER_DATA, 'logs', 'arborescent.log');
      expect(fs.existsSync(expectedPath)).toBe(true);
      const contents = fs.readFileSync(expectedPath, 'utf-8');
      expect(contents).toContain('persistence smoke test');
      expect(contents).toContain('[WorkflowExecution]');
    });

    it('appends rather than truncates between writes', () => {
      setElectronModule(makeElectronMock());

      logger.info('first', 'A');
      logger.info('second', 'A');
      logger.info('third', 'A');

      const filePath = path.join(FAKE_USER_DATA, 'logs', 'arborescent.log');
      const contents = fs.readFileSync(filePath, 'utf-8');
      expect(contents).toContain('first');
      expect(contents).toContain('second');
      expect(contents).toContain('third');
    });

    it('includes node_id field in serialised lines when provided', () => {
      setElectronModule(makeElectronMock());

      logger.info('hello node', 'WorkflowExecution', { nodeId: 'node-7' });

      const filePath = path.join(FAKE_USER_DATA, 'logs', 'arborescent.log');
      const contents = fs.readFileSync(filePath, 'utf-8');
      expect(contents).toContain('node=node-7');
    });

    it('serialises one entry per line so the file is grep-friendly', () => {
      setElectronModule(makeElectronMock());

      logger.info('line-1', 'A');
      logger.info('line-2', 'A');

      const filePath = path.join(FAKE_USER_DATA, 'logs', 'arborescent.log');
      const contents = fs.readFileSync(filePath, 'utf-8');
      const nonEmptyLines = contents.split('\n').filter((l) => l.length > 0);
      expect(nonEmptyLines).toHaveLength(2);
    });

  });

  describe('graceful degradation', () => {
    it('does not throw when electron module is null (worker-thread context)', () => {
      setElectronModule(null);

      expect(() => logger.info('test message', 'Test')).not.toThrow();
    });
  });

  describe('rotation policy', () => {
    it('rotates arborescent.log to arborescent.log.1 when size exceeds the cap', () => {
      setElectronModule(makeElectronMock());

      const filePath = path.join(FAKE_USER_DATA, 'logs', 'arborescent.log');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'x'.repeat(6 * 1024 * 1024));

      logger.info('triggers rotation', 'A');

      expect(fs.existsSync(`${filePath}.1`)).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
      const current = fs.readFileSync(filePath, 'utf-8');
      expect(current).toContain('triggers rotation');
    });

    it('keeps at most 3 rotated files and discards the oldest on further rotations', () => {
      setElectronModule(makeElectronMock());

      const filePath = path.join(FAKE_USER_DATA, 'logs', 'arborescent.log');
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });

      const trigger = (marker: string) => {
        fs.writeFileSync(filePath, 'x'.repeat(6 * 1024 * 1024));
        logger.info(marker, 'A');
      };

      trigger('round-1');
      trigger('round-2');
      trigger('round-3');
      trigger('round-4');

      expect(fs.existsSync(`${filePath}.1`)).toBe(true);
      expect(fs.existsSync(`${filePath}.2`)).toBe(true);
      expect(fs.existsSync(`${filePath}.3`)).toBe(true);
      expect(fs.existsSync(`${filePath}.4`)).toBe(false);
    });
  });

  describe('public surface', () => {
    it('exposes getLogFilePath() returning the absolute path inside userData/logs', () => {
      setElectronModule(makeElectronMock());

      const filePath = getLogFilePath();
      expect(filePath).toBeTypeOf('string');
      expect(filePath).toContain('logs');
      expect(filePath?.endsWith('.log')).toBe(true);
    });

    it('returns null from getLogFilePath() when electron is unavailable', () => {
      setElectronModule(null);

      expect(getLogFilePath()).toBeNull();
    });

    it('openLogFile() asks electron.shell to open the log file', async () => {
      const openPath: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue('');
      setElectronModule(makeElectronMock({ shellOpen: openPath }));

      await openLogFile();

      expect(openPath).toHaveBeenCalledTimes(1);
      const firstCall = openPath.mock.calls[0];
      expect(firstCall?.[0]).toContain('arborescent.log');
    });
  });
});
