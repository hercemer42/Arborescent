import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from '../../services/logger';
import {
  buildAncestorRegistry,
  checkRegistryConsistency,
} from '../ancestry';
import type { TreeNode } from '../../../shared/types';

const ROOT = 'root';
const STEP = 'step';
const SUBJECT = 'subject';

function node(id: string, children: string[] = []): TreeNode {
  return { id, content: id, children, metadata: {} };
}

const nodes: Record<string, TreeNode> = {
  [ROOT]: node(ROOT, [STEP]),
  [STEP]: node(STEP, [SUBJECT]),
  [SUBJECT]: node(SUBJECT, []),
};

describe('checkRegistryConsistency', () => {
  const warn = vi.mocked(logger.warn);
  beforeEach(() => warn.mockClear());

  it('returns true and logs nothing when the live registry matches children', () => {
    const live = buildAncestorRegistry(ROOT, nodes);
    expect(checkRegistryConsistency(ROOT, nodes, live, 'test')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('detects an ancestor-chain mismatch (the visual-vs-programmatic drift case)', () => {
    // children say SUBJECT is under STEP; the live registry stale-points it at ROOT.
    const live = buildAncestorRegistry(ROOT, nodes);
    live[SUBJECT] = [ROOT];

    expect(checkRegistryConsistency(ROOT, nodes, live, 'test')).toBe(false);
    expect(warn).toHaveBeenCalled();
    const msg = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(msg).toContain('ancestor mismatch');
    expect(msg).toContain(SUBJECT);
  });

  it('detects a node missing from the live registry', () => {
    const live = buildAncestorRegistry(ROOT, nodes);
    delete live[SUBJECT];
    expect(checkRegistryConsistency(ROOT, nodes, live, 'test')).toBe(false);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('missing node');
  });

  it('detects a stale node lingering in the live registry', () => {
    const live = buildAncestorRegistry(ROOT, nodes);
    live['ghost'] = [ROOT];
    expect(checkRegistryConsistency(ROOT, nodes, live, 'test')).toBe(false);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('stale node');
  });
});
