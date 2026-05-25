import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'js-yaml';
import { StorageService } from '../storageService';
import type { ArboFile } from '@shared/types';
import type { StepHistoryEntry } from '@/store/tree/stepHistory/stepHistory';

function makeEntry(rootId: string): StepHistoryEntry {
  return {
    id: `entry-${rootId}`,
    capturedAt: '2026-01-01T00:00:00.000Z',
    parentLabel: 'parent',
    rootNodeId: rootId,
    nodes: {
      [rootId]: { id: rootId, content: 'snap content', children: ['child'], metadata: {} },
      child: { id: 'child', content: 'snap child', children: [], metadata: {} },
    },
    position: 0,
  };
}

describe('StorageService — stepHistory round-trip', () => {
  let storage: StorageService;

  const baseArbo: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: '2025-01-01T00:00:00.000Z',
    updated: '2025-01-01T00:00:00.000Z',
    author: 'Test User',
    rootNodeId: 'root',
    nodes: {
      root: { id: 'root', content: 'Root', children: ['step-1'], metadata: {} },
      'step-1': { id: 'step-1', content: 'Step', children: [], metadata: { stepType: 'autonomous' } },
    },
  };

  beforeEach(() => {
    storage = new StorageService();
    vi.clearAllMocks();
  });

  it('loads a file that has no stepHistory field without error', async () => {
    const yamlContent = yaml.dump(baseArbo);
    vi.mocked(window.electron.readFile).mockResolvedValue(yamlContent);
    const result = await storage.loadDocument('/path/to/file.arbo');
    expect(result.rootNodeId).toBe('root');
    // stepHistory must be missing or an empty object after load — never crash on absence.
    const sh = (result as ArboFile & { stepHistory?: Record<string, StepHistoryEntry[]> }).stepHistory;
    if (sh !== undefined) {
      expect(Object.keys(sh).length).toBe(0);
    }
  });

  it('round-trips stepHistory entries on a file that has them', async () => {
    const fileWithHistory: ArboFile & {
      stepHistory: Record<string, StepHistoryEntry[]>;
    } = {
      ...baseArbo,
      stepHistory: {
        'step-1': [makeEntry('snap-a'), makeEntry('snap-b')],
      },
    };
    const yamlContent = yaml.dump(fileWithHistory);
    vi.mocked(window.electron.readFile).mockResolvedValue(yamlContent);
    const result = (await storage.loadDocument('/path/to/file.arbo')) as ArboFile & {
      stepHistory: Record<string, StepHistoryEntry[]>;
    };
    expect(result.stepHistory['step-1']).toHaveLength(2);
    expect(result.stepHistory['step-1'][0].rootNodeId).toBe('snap-a');
    expect(result.stepHistory['step-1'][1].rootNodeId).toBe('snap-b');
  });

  it('preserves absence of stepHistory in the saved file when input had no field', async () => {
    const writeMock = vi.mocked(window.electron.writeFile);
    await storage.saveDocument('/p.arbo', baseArbo);
    const yamlOut = writeMock.mock.calls[0][1] as string;
    const parsed = yaml.load(yamlOut) as ArboFile & { stepHistory?: unknown };
    if (parsed.stepHistory !== undefined) {
      expect(Object.keys(parsed.stepHistory as object).length).toBe(0);
    }
  });

  it('writes stepHistory entries back to YAML when present', async () => {
    const fileWithHistory: ArboFile & {
      stepHistory: Record<string, StepHistoryEntry[]>;
    } = {
      ...baseArbo,
      stepHistory: { 'step-1': [makeEntry('snap-a')] },
    };
    const writeMock = vi.mocked(window.electron.writeFile);
    await storage.saveDocument('/p.arbo', fileWithHistory);
    const yamlOut = writeMock.mock.calls[0][1] as string;
    const parsed = yaml.load(yamlOut) as ArboFile & {
      stepHistory: Record<string, StepHistoryEntry[]>;
    };
    expect(parsed.stepHistory['step-1']).toHaveLength(1);
    expect(parsed.stepHistory['step-1'][0].rootNodeId).toBe('snap-a');
  });

  it.todo('drops a step history entry whose rootNodeId points to a node missing from entry.nodes');

  it.todo(
    'opens a pre-existing .arbo file produced by an older app version and saves it back unchanged in stepHistory',
  );
});
