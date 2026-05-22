import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRebindPreflightStore } from '../rebindPreflightStore';

describe('rebindPreflightStore', () => {
  beforeEach(() => {
    useRebindPreflightStore.getState().clear();
  });

  it('starts with no current request', () => {
    expect(useRebindPreflightStore.getState().current).toBeNull();
  });

  it('request() sets the current pending preflight rebind', () => {
    const replay = vi.fn().mockResolvedValue(undefined);
    useRebindPreflightStore.getState().request({
      terminalId: 'term-1',
      previousNodeId: 'node-A',
      newNodeId: 'node-B',
      replay,
    });

    const current = useRebindPreflightStore.getState().current;
    expect(current?.terminalId).toBe('term-1');
    expect(current?.previousNodeId).toBe('node-A');
    expect(current?.newNodeId).toBe('node-B');
    expect(current?.replay).toBe(replay);
  });

  it('request() replaces an existing preflight (most recent wins)', () => {
    useRebindPreflightStore.getState().request({
      terminalId: 'term-1',
      previousNodeId: 'node-A',
      newNodeId: 'node-B',
      replay: vi.fn(),
    });
    useRebindPreflightStore.getState().request({
      terminalId: 'term-2',
      previousNodeId: 'node-C',
      newNodeId: 'node-D',
      replay: vi.fn(),
    });

    expect(useRebindPreflightStore.getState().current?.terminalId).toBe('term-2');
  });

  it('clear() removes the current request', () => {
    useRebindPreflightStore.getState().request({
      terminalId: 'term-1',
      previousNodeId: 'node-A',
      newNodeId: 'node-B',
      replay: vi.fn(),
    });
    useRebindPreflightStore.getState().clear();

    expect(useRebindPreflightStore.getState().current).toBeNull();
  });
});
