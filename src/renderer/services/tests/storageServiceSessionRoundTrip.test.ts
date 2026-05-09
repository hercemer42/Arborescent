import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'js-yaml';
import { StorageService } from '../storageService';
import type { ArboFile } from '../../../shared/types';

// PR1 — .arbo round-trip for session id + working directory + liveness.
// Terminal-tab pointer must NOT round-trip; it is runtime-only.

function fileWithSessionNode(metadata: Record<string, unknown>): ArboFile {
  return {
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
}

describe('StorageService — session metadata round-trip (PR1)', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
    vi.clearAllMocks();
  });

  it('persists sessionId on save and restores it on load', async () => {
    const file = fileWithSessionNode({
      sessionId: 'sess-123',
      sessionWorkingDirectory: '/work/dir',
      sessionLiveness: 'alive-detached',
    });

    vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
    await storage.saveDocument('/x.arbo', file);
    const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

    vi.mocked(window.electron.readFile).mockResolvedValue(written);
    const loaded = await storage.loadDocument('/x.arbo');

    expect(loaded.nodes.step.metadata.sessionId).toBe('sess-123');
    expect(loaded.nodes.step.metadata.sessionWorkingDirectory).toBe('/work/dir');
    expect(loaded.nodes.step.metadata.sessionLiveness).toBe('alive-detached');
  });

  it.todo('does NOT persist sessionTabId — terminal-tab pointer is runtime-only and stripped before write');

  it.todo('a node with sessionLiveness="lost" round-trips intact (loading should not silently revive lostness to alive)');

  it.todo('after load, every node with a sessionId starts with sessionLiveness reset to alive-detached or lost (never alive-attached) until probe runs');

  it.todo('a "starting" pre-spawn marker on a node is reconciled on load — converted to lost when no live session exists');

  it.todo('a sibling subtree with the same sessionId on multiple nodes is rejected or normalized at load (one-session-per-node invariant)');

  it('round-trips a file that has no session metadata (regression guard)', async () => {
    const file = fileWithSessionNode({});
    vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);
    await storage.saveDocument('/x.arbo', file);
    const written = vi.mocked(window.electron.writeFile).mock.calls[0][1];

    expect(written).not.toContain('sessionId');
    const reparsed = yaml.load(written) as ArboFile;
    expect(reparsed.nodes.step.metadata.sessionId).toBeUndefined();
  });
});
