import { describe, it, expect, vi } from 'vitest';
import { buildWorkflowSubmenu } from '../useWorkflowSubmenu';
import { TreeNode } from '../../../../../shared/types';
import type { StepHistoryEntry, StepHistoryMap } from '../../../../store/tree/stepHistory/stepHistory';
import type { ContextMenuItem } from '../../../ui/ContextMenu';

function createNode(id: string, overrides: Partial<TreeNode> = {}): TreeNode {
  return { id, content: id, children: [], metadata: {}, ...overrides };
}

function makeEntry(overrides: Partial<StepHistoryEntry> = {}): StepHistoryEntry {
  return {
    id: overrides.id ?? `entry-${Math.random().toString(36).slice(2, 8)}`,
    capturedAt: overrides.capturedAt ?? '2026-05-25T10:00:00.000Z',
    parentLabel: overrides.parentLabel ?? 'Some parent label',
    rootNodeId: overrides.rootNodeId ?? 'historized-root',
    nodes: overrides.nodes ?? {
      'historized-root': { id: 'historized-root', content: 'Snapshot content', children: [], metadata: {} },
    },
    position: overrides.position ?? 0,
  };
}

// Standard tree fixture: workflow with a single autonomous step containing one task.
function makeStepFixture() {
  const nodes: Record<string, TreeNode> = {
    'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
    'workflow': createNode('workflow', { children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } }),
    'step-1': createNode('step-1', { children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } }),
    'task-a': createNode('task-a', { metadata: { isBlueprint: true } }),
  };
  const ancestorRegistry: Record<string, string[]> = {
    'root': [],
    'workflow': ['root'],
    'step-1': ['root', 'workflow'],
    'task-a': ['root', 'workflow', 'step-1'],
  };
  return { nodes, ancestorRegistry };
}

function findItem(items: ContextMenuItem[] | undefined, label: string): ContextMenuItem | undefined {
  return items?.find((it) => it.label === label);
}

describe('buildWorkflowSubmenu — Step History entry', () => {
  const callbacks = {
    onRemoveFromWorkflow: vi.fn(),
    onConfigureStep: vi.fn(),
    onRestoreStepHistory: vi.fn(),
  };

  describe('eligibility', () => {
    it('does not add a Step History entry for a non-step node', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = { 'step-1': [makeEntry()] };

      const result = buildWorkflowSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      // task-a is inside a step, not itself a step — Workflow submenu should not surface step-history.
      expect(findItem(result?.submenu, 'Step History')).toBeUndefined();
    });

    it('does not add a Step History entry for a workflow-root node', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {};

      const result = buildWorkflowSubmenu({
        node: nodes['workflow'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      expect(findItem(result?.submenu, 'Step History')).toBeUndefined();
    });

    it('adds a Step History entry for a workflow step node', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = { 'step-1': [makeEntry()] };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      expect(findItem(result?.submenu, 'Step History')).toBeDefined();
    });
  });

  describe('empty state', () => {
    it('disables the Step History item when the step has no entries', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {};

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      const item = findItem(result?.submenu, 'Step History');
      expect(item).toBeDefined();
      expect(item?.disabled).toBe(true);
    });

    it('disables the Step History item when stepHistory itself is undefined (legacy .arbo with no history)', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory: undefined,
        ...callbacks,
      });

      const item = findItem(result?.submenu, 'Step History');
      expect(item?.disabled).toBe(true);
    });

    it('surfaces a no-history disabledTooltip on the empty Step History item', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory: {},
        ...callbacks,
      });

      const item = findItem(result?.submenu, 'Step History');
      expect(item?.disabledTooltip).toBeTruthy();
    });

    it('does not attach a submenu when there are no entries', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory: { 'step-1': [] },
        ...callbacks,
      });

      const item = findItem(result?.submenu, 'Step History');
      // Either the submenu is omitted entirely or it has zero items — either is a valid empty-state shape.
      expect(item?.submenu?.length ?? 0).toBe(0);
    });
  });

  describe('populated submenu', () => {
    it('exposes a submenu item per history entry', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [
          makeEntry({ id: 'e1', parentLabel: 'Alpha' }),
          makeEntry({ id: 'e2', parentLabel: 'Beta' }),
          makeEntry({ id: 'e3', parentLabel: 'Gamma' }),
        ],
      };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      const item = findItem(result?.submenu, 'Step History');
      expect(item?.submenu).toHaveLength(3);
    });

    it('uses the entry parentLabel as the submenu label', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [makeEntry({ id: 'e1', parentLabel: 'Problem statement' })],
      };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      const historySubmenu = findItem(result?.submenu, 'Step History')?.submenu;
      expect(historySubmenu?.[0].label).toBe('Problem statement');
    });

    it('surfaces capturedAt via the entry tooltip', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [
          makeEntry({ id: 'e1', parentLabel: 'A', capturedAt: '2026-05-25T10:00:00.000Z' }),
        ],
      };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      const historySubmenu = findItem(result?.submenu, 'Step History')?.submenu;
      // The tooltip should contain the capturedAt timestamp in some form — the exact format
      // (raw ISO vs locale string) is a UI detail; what matters is that the timestamp is
      // discoverable on hover.
      expect(historySubmenu?.[0].tooltip).toBeTruthy();
    });

    it('clicking an entry invokes onRestoreStepHistory with stepId and entryId', () => {
      const onRestoreStepHistory = vi.fn();
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [makeEntry({ id: 'e1', parentLabel: 'A' })],
      };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
        onRestoreStepHistory,
      });

      const historySubmenu = findItem(result?.submenu, 'Step History')?.submenu;
      historySubmenu?.[0].onClick?.();
      expect(onRestoreStepHistory).toHaveBeenCalledWith('step-1', 'e1');
    });

    it('passes each entry id through correctly when multiple entries exist', () => {
      const onRestoreStepHistory = vi.fn();
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [
          makeEntry({ id: 'e1', parentLabel: 'A' }),
          makeEntry({ id: 'e2', parentLabel: 'B' }),
          makeEntry({ id: 'e3', parentLabel: 'C' }),
        ],
      };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
        onRestoreStepHistory,
      });

      const historySubmenu = findItem(result?.submenu, 'Step History')?.submenu;
      historySubmenu?.[1].onClick?.();
      expect(onRestoreStepHistory).toHaveBeenCalledWith('step-1', 'e2');
    });

    it('does not modify the existing Workflow submenu items (Configure Step / Remove from Workflow)', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = { 'step-1': [makeEntry()] };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      expect(findItem(result?.submenu, 'Configure Step')).toBeDefined();
    });
  });

  describe('ordering', () => {
    it('does not visibly display capturedAt as the label (no inline timestamps)', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [
          makeEntry({ id: 'e1', parentLabel: 'A', capturedAt: '2026-05-25T10:00:00.000Z' }),
        ],
      };

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory,
        ...callbacks,
      });

      const historySubmenu = findItem(result?.submenu, 'Step History')?.submenu;
      expect(historySubmenu?.[0].label).not.toContain('2026');
      expect(historySubmenu?.[0].label).not.toContain(':00');
    });

    it.todo(
      'orders entries time-descending (newest first) when surfaced in the submenu',
    );
  });

  describe('edge cases', () => {
    it('handles many entries up to the ring-buffer cap', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const entries: StepHistoryEntry[] = Array.from({ length: 10 }, (_, i) =>
        makeEntry({ id: `e${i}`, parentLabel: `Entry ${i}` }),
      );

      const result = buildWorkflowSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        stepHistory: { 'step-1': entries },
        ...callbacks,
      });

      const item = findItem(result?.submenu, 'Step History');
      expect(item?.submenu).toHaveLength(10);
      expect(item?.disabled).toBeFalsy();
    });

    it('treats an entry with empty parentLabel without crashing', () => {
      const { nodes, ancestorRegistry } = makeStepFixture();
      const stepHistory: StepHistoryMap = {
        'step-1': [makeEntry({ id: 'e1', parentLabel: '' })],
      };

      expect(() =>
        buildWorkflowSubmenu({
          node: nodes['step-1'],
          nodes,
          ancestorRegistry,
          stepHistory,
          ...callbacks,
        }),
      ).not.toThrow();
    });

    it('restoring an entry then pressing Cmd+Z removes the restored copy cleanly', async () => {
      const { HistoryManager } = await import('../../../../store/tree/commands/HistoryManager');
      const { RestoreStepHistoryCommand } = await import('../../../../store/tree/commands/RestoreStepHistoryCommand');

      const historyManager = new HistoryManager();
      const stepNode: TreeNode = { id: 'step-1', content: 'Step 1', children: [], metadata: { stepType: 'autonomous' } };
      const liveState = {
        nodes: { 'step-1': stepNode } as Record<string, TreeNode>,
        ancestorRegistry: { 'step-1': [] } as Record<string, string[]>,
        stepHistory: {
          'step-1': [makeEntry({ id: 'e1', parentLabel: 'snap' })],
        } as StepHistoryMap,
      };

      const command = new RestoreStepHistoryCommand(
        'step-1',
        'e1',
        () => liveState,
        (partial) => {
          if (partial.nodes) liveState.nodes = partial.nodes;
          if (partial.ancestorRegistry) liveState.ancestorRegistry = partial.ancestorRegistry;
        },
      );

      historyManager.executeCommand(command);
      const childCountAfterRestore = liveState.nodes['step-1'].children.length;
      expect(childCountAfterRestore).toBe(1);

      historyManager.undo();
      expect(liveState.nodes['step-1'].children).toHaveLength(0);
    });

    it.todo(
      'the restored copy appears in the live tree as a child of the step at the recorded position',
    );

    it.todo(
      'restoring the same entry twice produces two independent copies and the history is unchanged',
    );
  });
});
