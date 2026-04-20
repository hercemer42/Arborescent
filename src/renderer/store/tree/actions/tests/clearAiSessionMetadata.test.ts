import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';

describe('Clear AI session — metadata shape', () => {
  describe('Default state', () => {
    it('treats an undefined clearSession on a legacy node as "off" (no clearing behaviour triggered)');

    it('accepts clearSession: true on a workflow step node without type errors', () => {
      const node: TreeNode = {
        id: 'step-1',
        content: 'Step 1',
        children: [],
        metadata: { stepType: 'autonomous', clearSession: true },
      };

      expect(node.metadata.clearSession).toBe(true);
    });

    it('accepts clearSession: false on a workflow step node without type errors', () => {
      const node: TreeNode = {
        id: 'step-1',
        content: 'Step 1',
        children: [],
        metadata: { stepType: 'autonomous', clearSession: false },
      };

      expect(node.metadata.clearSession).toBe(false);
    });
  });

  describe('Persistence roundtrip', () => {
    it('save → reload preserves clearSession on a workflow step node');
    it('blueprint export includes clearSession; blueprint import restores it');
    it('copying a workflow step node preserves clearSession on the copy');
  });
});
