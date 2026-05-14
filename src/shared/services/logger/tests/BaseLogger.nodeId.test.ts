import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseLogger } from '../BaseLogger';

class TestLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, meta?: { nodeId?: string }): void {
    this.log('error', message, context, error, meta);
  }
}

describe('BaseLogger node_id metadata', () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('memory entry', () => {
    it('should store nodeId on the LogEntry when provided', () => {
      logger.info('starting step', 'WorkflowExecution', { nodeId: 'node-42' });

      const entry = logger.getLogs()[0];
      expect(entry.nodeId).toBe('node-42');
    });

    it('should leave nodeId undefined when not provided', () => {
      logger.info('starting step', 'WorkflowExecution');

      const entry = logger.getLogs()[0];
      expect(entry.nodeId).toBeUndefined();
    });

    it('should preserve nodeId across all log levels', () => {
      logger.debug('d', 'C', { nodeId: 'n1' });
      logger.info('i', 'C', { nodeId: 'n2' });
      logger.warn('w', 'C', { nodeId: 'n3' });
      logger.error('e', undefined, 'C', { nodeId: 'n4' });

      const ids = logger.getLogs().map((entry) => entry.nodeId);
      expect(ids).toEqual(['n1', 'n2', 'n3', 'n4']);
    });
  });

  describe('exportLogs', () => {
    it('should include node=<id> token when nodeId is present', () => {
      logger.info('starting step', 'WorkflowExecution', { nodeId: 'node-42' });

      const exported = logger.exportLogs();
      expect(exported).toContain('node-42');
    });

    it('should not emit a node=<id> token when nodeId is absent', () => {
      logger.info('starting step', 'WorkflowExecution');

      const exported = logger.exportLogs();
      expect(exported).not.toMatch(/node=/);
    });
  });

  describe('grep-ability', () => {
    it('should let a single node lifecycle be filtered from the buffer', () => {
      logger.info('a', 'C', { nodeId: 'node-A' });
      logger.info('b', 'C', { nodeId: 'node-B' });
      logger.info('c', 'C', { nodeId: 'node-A' });

      const onlyA = logger.getLogs().filter((entry) => entry.nodeId === 'node-A');
      expect(onlyA.map((entry) => entry.message)).toEqual(['a', 'c']);
    });
  });
});
