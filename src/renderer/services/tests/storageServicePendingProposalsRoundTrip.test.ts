import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'js-yaml';
import { StorageService } from '../storageService';
import { createArboFile } from '../../utils/document';
import type { ArboFile, PendingProposalEntry, TreeNode } from '@shared/types';

function makeEntry(reviewedNodeId: string, rootId: string): PendingProposalEntry {
  return {
    id: `proposal-${reviewedNodeId}`,
    capturedAt: '2026-01-01T00:00:00.000Z',
    reviewedNodeId,
    rootNodeId: rootId,
    nodes: {
      [rootId]: { id: rootId, content: 'proposed root', children: ['p-child'], metadata: {} },
      'p-child': { id: 'p-child', content: 'proposed child', children: [], metadata: {} },
    },
  };
}

describe('StorageService — pendingProposals round-trip', () => {
  let storage: StorageService;

  const baseArbo: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: '2025-01-01T00:00:00.000Z',
    updated: '2025-01-01T00:00:00.000Z',
    author: 'Test User',
    rootNodeId: 'root',
    nodes: {
      root: { id: 'root', content: 'Root', children: ['reviewed'], metadata: {} },
      reviewed: { id: 'reviewed', content: 'Reviewed node', children: [], metadata: {} },
    },
  };

  beforeEach(() => {
    storage = new StorageService();
    vi.clearAllMocks();
  });

  it('loads a file that has no pendingProposals field without error', async () => {
    vi.mocked(window.electron.readFile).mockResolvedValue(yaml.dump(baseArbo));
    const result = await storage.loadDocument('/path/to/file.arbo');
    expect(result.rootNodeId).toBe('root');
    if (result.pendingProposals !== undefined) {
      expect(Object.keys(result.pendingProposals).length).toBe(0);
    }
  });

  it('round-trips a pending proposition on a file that has one', async () => {
    const fileWith: ArboFile = {
      ...baseArbo,
      pendingProposals: { reviewed: makeEntry('reviewed', 'snap-root') },
    };
    vi.mocked(window.electron.readFile).mockResolvedValue(yaml.dump(fileWith));
    const result = await storage.loadDocument('/path/to/file.arbo');
    expect(result.pendingProposals?.reviewed).toBeDefined();
    expect(result.pendingProposals?.reviewed.rootNodeId).toBe('snap-root');
    expect(result.pendingProposals?.reviewed.nodes['snap-root']).toBeDefined();
  });

  it('keys each pending proposition by its reviewed node id', async () => {
    const fileWith: ArboFile = {
      ...baseArbo,
      pendingProposals: {
        reviewed: makeEntry('reviewed', 'snap-a'),
        root: makeEntry('root', 'snap-b'),
      },
    };
    vi.mocked(window.electron.readFile).mockResolvedValue(yaml.dump(fileWith));
    const result = await storage.loadDocument('/p.arbo');
    expect(Object.keys(result.pendingProposals ?? {}).sort()).toEqual(['reviewed', 'root']);
    expect(result.pendingProposals?.reviewed.reviewedNodeId).toBe('reviewed');
  });

  it('preserves absence of pendingProposals in the saved file when input had no field', async () => {
    const writeMock = vi.mocked(window.electron.writeFile);
    await storage.saveDocument('/p.arbo', baseArbo);
    const yamlOut = writeMock.mock.calls[0][1] as string;
    const parsed = yaml.load(yamlOut) as ArboFile;
    if (parsed.pendingProposals !== undefined) {
      expect(Object.keys(parsed.pendingProposals).length).toBe(0);
    }
  });

  it('writes a pending proposition back to YAML when present', async () => {
    const fileWith: ArboFile = {
      ...baseArbo,
      pendingProposals: { reviewed: makeEntry('reviewed', 'snap-a') },
    };
    const writeMock = vi.mocked(window.electron.writeFile);
    await storage.saveDocument('/p.arbo', fileWith);
    const yamlOut = writeMock.mock.calls[0][1] as string;
    const parsed = yaml.load(yamlOut) as ArboFile;
    expect(parsed.pendingProposals?.reviewed.rootNodeId).toBe('snap-a');
  });
});

describe('createArboFile — pendingProposals serialization', () => {
  const canonicalNodes: Record<string, TreeNode> = {
    root: { id: 'root', content: 'Root', children: ['reviewed'], metadata: {} },
    reviewed: { id: 'reviewed', content: 'Reviewed node', children: [], metadata: {} },
  };

  it('emits the pendingProposals map as a top-level key when present', () => {
    const file = createArboFile(canonicalNodes, 'root', undefined, undefined, null, null, undefined, {
      reviewed: makeEntry('reviewed', 'snap-root'),
    });
    expect(file.pendingProposals?.reviewed.rootNodeId).toBe('snap-root');
  });

  it('omits pendingProposals when the map is empty', () => {
    const file = createArboFile(canonicalNodes, 'root', undefined, undefined, null, null, undefined, {});
    expect(file.pendingProposals).toBeUndefined();
  });

  it('keeps the canonical nodes tree free of proposition snapshot nodes', () => {
    const entry = makeEntry('reviewed', 'snap-root');
    const file = createArboFile(canonicalNodes, 'root', undefined, undefined, null, null, undefined, {
      reviewed: entry,
    });
    for (const snapshotId of Object.keys(entry.nodes)) {
      expect(file.nodes[snapshotId]).toBeUndefined();
    }
    expect(Object.keys(file.nodes).sort()).toEqual(['reviewed', 'root']);
  });
});
