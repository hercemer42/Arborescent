import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseLogger } from '../BaseLogger';

class TestLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string): void {
    this.log('error', message, context, error);
  }
}

describe('BaseLogger', () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('debug', () => {
    it('should log debug message', () => {
      logger.debug('test message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('debug');
      expect(logs[0].message).toBe('test message');
    });

    it('should log debug message with context', () => {
      logger.debug('test message', 'TestContext');

      const logs = logger.getLogs();
      expect(logs[0].context).toBe('TestContext');
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('test message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('test message');
    });

    it('should log info message with context', () => {
      logger.info('test message', 'TestContext');

      const logs = logger.getLogs();
      expect(logs[0].context).toBe('TestContext');
    });
  });

  describe('warn', () => {
    it('should log warn message', () => {
      logger.warn('test message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe('test message');
    });

    it('should log warn message with context', () => {
      logger.warn('test message', 'TestContext');

      const logs = logger.getLogs();
      expect(logs[0].context).toBe('TestContext');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      logger.error('test message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('test message');
    });

    it('should log error message with Error object', () => {
      const error = new Error('test error');
      logger.error('test message', error);

      const logs = logger.getLogs();
      expect(logs[0].error).toBe(error);
    });

    it('should log error message with context', () => {
      logger.error('test message', undefined, 'TestContext');

      const logs = logger.getLogs();
      expect(logs[0].context).toBe('TestContext');
    });
  });

  describe('getLogs', () => {
    it('should return empty array initially', () => {
      expect(logger.getLogs()).toEqual([]);
    });

    it('should return all logged entries', () => {
      logger.info('message 1');
      logger.warn('message 2');
      logger.error('message 3');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('message 1');
      expect(logs[1].message).toBe('message 2');
      expect(logs[2].message).toBe('message 3');
    });

    it('should return a copy of logs array', () => {
      logger.info('test');
      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();

      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      logger.info('message 1');
      logger.warn('message 2');

      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();

      expect(logger.getLogs()).toEqual([]);
    });
  });

  describe('exportLogs', () => {
    it('should export logs as formatted string', () => {
      logger.info('test message', 'TestContext');

      const exported = logger.exportLogs();

      expect(exported).toContain('INFO');
      expect(exported).toContain('[TestContext]');
      expect(exported).toContain('test message');
    });

    it('should export error with stack trace', () => {
      const error = new Error('test error');
      logger.error('error message', error, 'TestContext');

      const exported = logger.exportLogs();

      expect(exported).toContain('ERROR');
      expect(exported).toContain('error message');
      expect(exported).toContain(error.stack);
    });

    it('should handle logs without context', () => {
      logger.info('test message');

      const exported = logger.exportLogs();

      expect(exported).toContain('INFO');
      expect(exported).toContain('test message');
      expect(exported).not.toMatch(/\[.*\]\s*\[.*\]/);
    });
  });

  describe('log limit', () => {
    it('should keep only last 1000 logs', () => {
      for (let i = 0; i < 1500; i++) {
        logger.info(`message ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1000);
      expect(logs[0].message).toBe('message 500');
      expect(logs[999].message).toBe('message 1499');
    });
  });

  describe('console output', () => {
    it('should output debug to console.debug', () => {
      logger.debug('test', 'Context');
      expect(console.debug).toHaveBeenCalledWith('[Context] test');
    });

    it('should output info to console.log', () => {
      logger.info('test', 'Context');
      expect(console.log).toHaveBeenCalledWith('[Context] test');
    });

    it('should output warn to console.warn', () => {
      logger.warn('test', 'Context');
      expect(console.warn).toHaveBeenCalledWith('[Context] test');
    });

    it('should output error to console.error with Error object', () => {
      const error = new Error('test error');
      logger.error('test', error, 'Context');
      expect(console.error).toHaveBeenCalledWith('[Context] test', error);
    });

    it('should output error to console.error without Error object', () => {
      logger.error('test', undefined, 'Context');
      expect(console.error).toHaveBeenCalledWith('[Context] test');
    });

    it('should handle logs without context', () => {
      logger.info('test');
      expect(console.log).toHaveBeenCalledWith(' test');
    });
  });
});
