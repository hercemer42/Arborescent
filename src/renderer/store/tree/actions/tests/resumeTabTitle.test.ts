import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { resumeTabTitle } from '../workflowSessionResume';

const { mockTerminals } = vi.hoisted(() => ({
  mockTerminals: { value: [] as Array<{ id: string }> },
}));
vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({ terminals: mockTerminals.value }),
  },
}));

function makeNode(id: string, content: string): TreeNode {
  return { id, content, children: [], metadata: {} } as unknown as TreeNode;
}

describe('resumeTabTitle — shared helper for both resume-tab call sites', () => {
  beforeEach(() => {
    mockTerminals.value = [];
  });

  it('does not return the literal string "Resume" for any input', () => {
    mockTerminals.value = [];
    expect(resumeTabTitle(undefined)).not.toBe('Resume');
    expect(resumeTabTitle(makeNode('n', ''))).not.toBe('Resume');
    expect(resumeTabTitle(makeNode('n', 'Investigate session regression'))).not.toBe('Resume');
  });

  it('derives the title from the originating node\'s first non-empty line of content when one is available', () => {
    const node = makeNode('node-A', 'Investigate session regression\nsecond line');
    expect(resumeTabTitle(node)).toBe('Investigate session regression');
  });

  it('falls back to "Terminal N" when the originating node has no usable content', () => {
    mockTerminals.value = [{ id: 'term-1' }, { id: 'term-2' }];
    const node = makeNode('node-A', '   \n  ');
    expect(resumeTabTitle(node)).toBe('Terminal 3');
  });

  it('falls back to "Terminal N" when no node is provided at all', () => {
    mockTerminals.value = [{ id: 'term-1' }];
    expect(resumeTabTitle(undefined)).toBe('Terminal 2');
  });

  it('numbers the fallback off the current terminals list so opening a new tab never collides with an existing one', () => {
    mockTerminals.value = [];
    expect(resumeTabTitle(undefined)).toBe('Terminal 1');
    mockTerminals.value = [{ id: 'a' }];
    expect(resumeTabTitle(undefined)).toBe('Terminal 2');
    mockTerminals.value = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(resumeTabTitle(undefined)).toBe('Terminal 4');
  });
});
