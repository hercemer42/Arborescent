import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'js-yaml';
import { StorageService } from '../storageService';
import type { ArboFile } from '../../../shared/types';

// PR1 — .arbo round-trip for sessionRegistry + sessionId.
// Dropped node fields (sessionLiveness, sessionTabId, sessionWorkingDirectory,
// sessionStarting, sessionLost) must NOT survive a save/load cycle.
// sessionRegistry must round-trip alongside nodes.

function fileWithSessionNode(
  metadata: Record<string, unknown> = {},
  sessionRegistry?: Record<string, { cwd: string }>,
): ArboFile {
  const file: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: '2026-05-09T00:00:00.000Z',
    updated: '2026-05-09T00:00:00.000Z',
    author: 'Test',
    rootNodeId: 'root',
    nodes: {
      root: { id: 'root', content: 'Root', children: ['step'], metadata: {} },
      step: {
        id: 'step',
        content: 'autonomous step',
        children: [],
        metadata: { isWorkflow: true, stepType: 'autonomous', ...metadata },
      },
    },
  };
  if (sessionRegistry) file.sessionRegistry = sessionRegistry;
  return file;
}

describe('StorageService — session registry round-trip (PR1)', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
    vi.clearAllMocks();
  });

  describe('sessionRegistry persists alongside nodes', () => {
    it('saves sessionRegistry to disk and restores it on load', async () => {
      const file = fileWithSessionNode(
        { sessionId: 'sess-123' },
        { 'sess-123': { cwd: '/work/dir' } },
      );

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      vi.mocked(window.electron.readFile).mockResolvedValue(written);
      const loaded = await storage.loadDocument('/x.arbo');

      expect(loaded.sessionRegistry?.['sess-123']).toEqual({ cwd: '/work/dir' });
    });

    it('preserves the cwd value in sessionRegistry through the round-trip', async () => {
      const cwd = '/Users/me/my-project';
      const file = fileWithSessionNode(
        { sessionId: 'sess-abc' },
        { 'sess-abc': { cwd } },
      );

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      vi.mocked(window.electron.readFile).mockResolvedValue(written);
      const loaded = await storage.loadDocument('/x.arbo');

      expect(loaded.sessionRegistry?.['sess-abc']?.cwd).toBe(cwd);
    });

    it('persists sessionId on the node and restores it', async () => {
      const file = fileWithSessionNode({ sessionId: 'sess-123' });

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      vi.mocked(window.electron.readFile).mockResolvedValue(written);
      const loaded = await storage.loadDocument('/x.arbo');

      expect(loaded.nodes.step.metadata.sessionId).toBe('sess-123');
    });

    it('round-trips a file with no session data cleanly', async () => {
      const file = fileWithSessionNode({});
      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      expect(written).not.toContain('sessionId');
      const reparsed = yaml.load(written) as ArboFile;
      expect(reparsed.nodes.step.metadata.sessionId).toBeUndefined();
      expect(reparsed.sessionRegistry).toBeUndefined();
    });
  });

  describe('dropped node fields are NOT saved', () => {
    it('does not persist sessionLiveness on the node', async () => {
      const file = fileWithSessionNode({
        sessionId: 'sess-1',
        sessionLiveness: 'alive-detached',
      });

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      const reparsed = yaml.load(written) as ArboFile;
      expect(reparsed.nodes.step.metadata.sessionLiveness).toBeUndefined();
    });

    it('does not persist sessionTabId on the node', async () => {
      const file = fileWithSessionNode({ sessionTabId: 'tab-1' });

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      const reparsed = yaml.load(written) as ArboFile;
      expect(reparsed.nodes.step.metadata.sessionTabId).toBeUndefined();
    });

    it('does not persist sessionWorkingDirectory on the node', async () => {
      const file = fileWithSessionNode({ sessionWorkingDirectory: '/some/path' });

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      const reparsed = yaml.load(written) as ArboFile;
      expect(reparsed.nodes.step.metadata.sessionWorkingDirectory).toBeUndefined();
    });

    it('does not persist sessionStarting on the node', async () => {
      const file = fileWithSessionNode({ sessionStarting: true });

      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
      await storage.saveDocument('/x.arbo', file);
      const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

      const reparsed = yaml.load(written) as ArboFile;
      expect(reparsed.nodes.step.metadata.sessionStarting).toBeUndefined();
    });
  });

  describe('strip-fields migration on load', () => {
    it('loads an old .arbo file with sessionLiveness and strips the field silently', async () => {
      const oldYaml = yaml.dump({
        format: 'Arborescent',
        version: '1.0.0',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
        author: 'Test',
        rootNodeId: 'root',
        nodes: {
          root: { id: 'root', content: 'Root', children: ['step'], metadata: {} },
          step: {
            id: 'step',
            content: 'step',
            children: [],
            metadata: {
              sessionId: 'sess-old',
              sessionLiveness: 'alive-attached',
              sessionTabId: 'tab-old',
              sessionWorkingDirectory: '/old/path',
            },
          },
        },
      });

      vi.mocked(window.electron.readFile).mockResolvedValue(oldYaml);
      const loaded = await storage.loadDocument('/old.arbo');

      expect(loaded.nodes.step.metadata.sessionId).toBe('sess-old');
      expect(loaded.nodes.step.metadata.sessionLiveness).toBeUndefined();
      expect(loaded.nodes.step.metadata.sessionTabId).toBeUndefined();
      expect(loaded.nodes.step.metadata.sessionWorkingDirectory).toBeUndefined();
    });

    it('loads an old .arbo with sessionStarting:true and strips it', async () => {
      const oldYaml = yaml.dump({
        format: 'Arborescent',
        version: '1.0.0',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
        author: 'Test',
        rootNodeId: 'root',
        nodes: {
          root: { id: 'root', content: 'Root', children: ['step'], metadata: {} },
          step: {
            id: 'step', content: 'step', children: [],
            metadata: { sessionStarting: true },
          },
        },
      });

      vi.mocked(window.electron.readFile).mockResolvedValue(oldYaml);
      const loaded = await storage.loadDocument('/old.arbo');
      expect(loaded.nodes.step.metadata.sessionStarting).toBeUndefined();
    });
  });

  describe('sessionRegistry GC on load', () => {
    it('drops a registry entry that no node references', async () => {
      const fileYaml = yaml.dump({
        format: 'Arborescent',
        version: '1.0.0',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
        author: 'Test',
        rootNodeId: 'root',
        sessionRegistry: {
          'sess-live': { cwd: '/live' },
          'sess-dead': { cwd: '/dead' },
        },
        nodes: {
          root: { id: 'root', content: 'Root', children: ['step'], metadata: {} },
          step: {
            id: 'step', content: 'step', children: [],
            metadata: { sessionId: 'sess-live' },
          },
        },
      });

      vi.mocked(window.electron.readFile).mockResolvedValue(fileYaml);
      const loaded = await storage.loadDocument('/x.arbo');

      expect(loaded.sessionRegistry?.['sess-live']).toBeDefined();
      expect(loaded.sessionRegistry?.['sess-dead']).toBeUndefined();
    });

    it('keeps registry entry referenced by any node', async () => {
      const fileYaml = yaml.dump({
        format: 'Arborescent',
        version: '1.0.0',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
        author: 'Test',
        rootNodeId: 'root',
        sessionRegistry: { 'sess-shared': { cwd: '/shared' } },
        nodes: {
          root: { id: 'root', content: 'Root', children: ['a', 'b'], metadata: {} },
          a: { id: 'a', content: 'A', children: [], metadata: { sessionId: 'sess-shared' } },
          b: { id: 'b', content: 'B', children: [], metadata: { sessionId: 'sess-shared' } },
        },
      });

      vi.mocked(window.electron.readFile).mockResolvedValue(fileYaml);
      const loaded = await storage.loadDocument('/x.arbo');

      expect(loaded.sessionRegistry?.['sess-shared']).toEqual({ cwd: '/shared' });
    });

    it('results in empty or absent registry when no nodes have sessionIds', async () => {
      const fileYaml = yaml.dump({
        format: 'Arborescent',
        version: '1.0.0',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
        author: 'Test',
        rootNodeId: 'root',
        sessionRegistry: { 'orphan': { cwd: '/x' } },
        nodes: {
          root: { id: 'root', content: 'Root', children: [], metadata: {} },
        },
      });

      vi.mocked(window.electron.readFile).mockResolvedValue(fileYaml);
      const loaded = await storage.loadDocument('/x.arbo');

      const entries = Object.keys(loaded.sessionRegistry ?? {});
      expect(entries).toHaveLength(0);
    });
  });
});
