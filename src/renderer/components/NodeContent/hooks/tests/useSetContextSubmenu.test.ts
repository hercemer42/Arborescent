import { describe, it, expect, vi } from 'vitest';
import { buildSetContextSubmenu } from '../useSetContextSubmenu';
import { BASIC_EXECUTE_CONTEXT_ID, BASIC_REVIEW_CONTEXT_ID } from '../../../../utils/nodeHelpers';
import type { TreeNode } from '../../../../../shared/types';
import type { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

vi.mock('../../../ui/CustomizeDialog/CustomizeDialog', () => ({
  getIconByName: () => null,
}));

describe('buildSetContextSubmenu', () => {
  const createNode = (id: string, metadata: Record<string, unknown> = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  const defaultParams = (overrides: Partial<Parameters<typeof buildSetContextSubmenu>[0]> = {}) => ({
    node: createNode('target-node'),
    nodes: {
      'target-node': createNode('target-node'),
      'collab-ctx': createNode('collab-ctx', { isContextDeclaration: true }),
      'exec-ctx': createNode('exec-ctx', { isContextDeclaration: true }),
    },
    ancestorRegistry: {
      'target-node': ['root'],
      'collab-ctx': ['root'],
      'exec-ctx': ['root'],
      'root': [],
    } as Record<string, string[]>,
    contextDeclarations: [
      { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', mode: 'collaborate' as const },
      { nodeId: 'exec-ctx', content: 'My Script', icon: 'zap', mode: 'execute' as const },
    ] as ContextDeclarationInfo[],
    onSetAppliedContext: vi.fn(),
    ...overrides,
  });

  it('should return null when no contexts are available and a context is inherited', () => {
    const result = buildSetContextSubmenu(defaultParams({
      contextDeclarations: [],
      nodes: {
        'target-node': createNode('target-node'),
        'parent-node': createNode('parent-node', { appliedContextId: 'inh-ctx' }),
        'inh-ctx': createNode('inh-ctx', { isContextDeclaration: true }),
      },
      ancestorRegistry: {
        'target-node': ['root', 'parent-node'],
        'parent-node': ['root'],
        'inh-ctx': ['root'],
        'root': [],
      },
    }));
    expect(result).toBeNull();
  });

  it('shows only built-in defaults when no user contexts exist and nothing is inherited', () => {
    const result = buildSetContextSubmenu(defaultParams({ contextDeclarations: [] }));
    expect(result).not.toBeNull();
    const labels = result!.map(item => item.label);
    expect(labels).toContain('Basic review');
    expect(labels).toContain('Basic execution');
  });

  describe('section structure', () => {
    it('should contain a disabled "Collaborate" header item', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const collaborateHeader = result!.find(item => item.label === 'Collaborate');
      expect(collaborateHeader).toBeDefined();
      expect(collaborateHeader?.disabled).toBe(true);
    });

    it('should contain a disabled "Execute" header item', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const executeHeader = result!.find(item => item.label === 'Execute');
      expect(executeHeader).toBeDefined();
      expect(executeHeader?.disabled).toBe(true);
    });

    it('should show "Collaborate" section before "Execute" section', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label).filter(Boolean);
      const collabIndex = labels.indexOf('Collaborate');
      const execIndex = labels.indexOf('Execute');
      expect(collabIndex).toBeLessThan(execIndex);
    });
  });

  describe('custom context grouping', () => {
    it('should show collaborate-mode contexts under Collaborate section', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const execHeaderIdx = labels.indexOf('Execute');
      const myReviewIdx = labels.indexOf('My Review');

      expect(myReviewIdx).toBeGreaterThan(collabHeaderIdx);
      expect(myReviewIdx).toBeLessThan(execHeaderIdx);
    });

    it('should show execute-mode contexts under Execute section', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const execHeaderIdx = labels.indexOf('Execute');
      const myScriptIdx = labels.indexOf('My Script');

      expect(myScriptIdx).toBeGreaterThan(execHeaderIdx);
    });

    it('should append "(inherited)" to inherited context name', () => {
      const result = buildSetContextSubmenu(defaultParams({
        nodes: {
          'target-node': createNode('target-node'),
          'parent-node': createNode('parent-node', { appliedContextId: 'collab-ctx' }),
          'collab-ctx': createNode('collab-ctx', { isContextDeclaration: true }),
          'exec-ctx': createNode('exec-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root', 'parent-node'],
          'parent-node': ['root'],
          'collab-ctx': ['root'],
          'exec-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const inheritedItem = result!.find(item => item.label?.includes('(inherited)'));
      expect(inheritedItem).toBeDefined();
      expect(inheritedItem!.label).toBe('My Review (inherited)');
    });
  });

  describe('selection behavior', () => {
    it('should call onSetAppliedContext with contextId when selecting a custom context', () => {
      const onSetAppliedContext = vi.fn();
      const result = buildSetContextSubmenu(defaultParams({ onSetAppliedContext }));

      const contextItem = result!.find(item => item.label === 'My Review');
      contextItem?.onClick?.();

      expect(onSetAppliedContext).toHaveBeenCalledWith('collab-ctx');
    });

    it('should call onSetAppliedContext with null when deselecting active context', () => {
      const onSetAppliedContext = vi.fn();
      const result = buildSetContextSubmenu(defaultParams({
        node: createNode('target-node', { appliedContextId: 'collab-ctx' }),
        onSetAppliedContext,
      }));

      const contextItem = result!.find(item => item.label === 'My Review');
      contextItem?.onClick?.();

      expect(onSetAppliedContext).toHaveBeenCalledWith(null);
    });

  });

  describe('built-in defaults', () => {
    it('shows "Basic review" under Collaborate when no inherited context', () => {
      const result = buildSetContextSubmenu(defaultParams());

      const basicReview = result!.find(item => item.label === 'Basic review');
      expect(basicReview).toBeDefined();
    });

    it('shows "Basic execution" under Execute when no inherited context', () => {
      const result = buildSetContextSubmenu(defaultParams());

      const basicExec = result!.find(item => item.label === 'Basic execution');
      expect(basicExec).toBeDefined();
    });

    it('marks "Basic review" radio-selected when BASIC_REVIEW_CONTEXT_ID is explicitly applied', () => {
      const result = buildSetContextSubmenu(defaultParams({
        node: createNode('target-node', { appliedContextId: BASIC_REVIEW_CONTEXT_ID }),
      }));

      const basicReview = result!.find(item => item.label === 'Basic review');
      expect(basicReview?.radioSelected).toBe(true);
    });

    it('does not mark "Basic review" radio-selected when no explicit context is set', () => {
      const result = buildSetContextSubmenu(defaultParams());

      const basicReview = result!.find(item => item.label === 'Basic review');
      expect(basicReview?.radioSelected).toBeFalsy();
    });

    it('hides built-in defaults when a context is inherited', () => {
      const result = buildSetContextSubmenu(defaultParams({
        nodes: {
          'target-node': createNode('target-node'),
          'parent-node': createNode('parent-node', { appliedContextId: 'collab-ctx' }),
          'collab-ctx': createNode('collab-ctx', { isContextDeclaration: true }),
          'exec-ctx': createNode('exec-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root', 'parent-node'],
          'parent-node': ['root'],
          'collab-ctx': ['root'],
          'exec-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const basicReview = result!.find(item => item.label === 'Basic review');
      const basicExec = result!.find(item => item.label === 'Basic execution');
      expect(basicReview).toBeUndefined();
      expect(basicExec).toBeUndefined();
    });

    it('calls onSetAppliedContext with BASIC_REVIEW_CONTEXT_ID when selecting "Basic review"', () => {
      const onSetAppliedContext = vi.fn();
      const result = buildSetContextSubmenu(defaultParams({ onSetAppliedContext }));

      const basicReview = result!.find(item => item.label === 'Basic review');
      basicReview?.onClick?.();

      expect(onSetAppliedContext).toHaveBeenCalledWith(BASIC_REVIEW_CONTEXT_ID);
    });

    it('calls onSetAppliedContext with BASIC_EXECUTE_CONTEXT_ID when selecting "Basic execution"', () => {
      const onSetAppliedContext = vi.fn();
      const result = buildSetContextSubmenu(defaultParams({ onSetAppliedContext }));

      const basicExec = result!.find(item => item.label === 'Basic execution');
      basicExec?.onClick?.();

      expect(onSetAppliedContext).toHaveBeenCalledWith(BASIC_EXECUTE_CONTEXT_ID);
    });

    it('toggles off when clicking the active "Basic review" entry', () => {
      const onSetAppliedContext = vi.fn();
      const result = buildSetContextSubmenu(defaultParams({
        node: createNode('target-node', { appliedContextId: BASIC_REVIEW_CONTEXT_ID }),
        onSetAppliedContext,
      }));

      const basicReview = result!.find(item => item.label === 'Basic review');
      basicReview?.onClick?.();

      expect(onSetAppliedContext).toHaveBeenCalledWith(null);
    });
  });

  describe('empty states', () => {
    it('shows only built-ins when all user contexts are ancestors', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'collab-ctx', content: 'Hidden', icon: 'star', mode: 'collaborate' as const },
        ] as ContextDeclarationInfo[],
        ancestorRegistry: {
          'target-node': ['root', 'collab-ctx'],
          'collab-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      expect(labels).toContain('Basic review');
      expect(labels).toContain('Basic execution');
      expect(labels).not.toContain('Hidden');
    });

    it('Execute section contains only "Basic execution" when no user execute contexts exist', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', mode: 'collaborate' as const },
        ] as ContextDeclarationInfo[],
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const execHeaderIdx = labels.indexOf('Execute');
      const closeIdx = labels.indexOf('Close');
      const itemsBetween = labels.slice(execHeaderIdx + 1, closeIdx).filter(l => l !== '-' && l !== undefined);
      expect(itemsBetween).toEqual(['Basic execution']);
    });

    it('Collaborate section contains only "Basic review" when no user collaborate contexts exist', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'exec-ctx', content: 'My Script', icon: 'zap', mode: 'execute' as const },
        ] as ContextDeclarationInfo[],
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const execHeaderIdx = labels.indexOf('Execute');
      const itemsBetween = labels.slice(collabHeaderIdx + 1, execHeaderIdx).filter(l => l !== '-' && l !== undefined);
      expect(itemsBetween).toEqual(['Basic review']);
    });
  });

  it('should truncate long context names', () => {
    const longName = 'A'.repeat(50);
    const result = buildSetContextSubmenu(defaultParams({
      contextDeclarations: [
        { nodeId: 'collab-ctx', content: longName, icon: 'star', mode: 'collaborate' as const },
      ] as ContextDeclarationInfo[],
    }));

    expect(result).not.toBeNull();
    const contextItem = result!.find(item => item.label?.includes('...'));
    expect(contextItem).toBeDefined();
    expect(contextItem!.label!.length).toBeLessThan(longName.length);
  });

  it('should include Close footer item', () => {
    const result = buildSetContextSubmenu(defaultParams());

    expect(result).not.toBeNull();
    expect(result![result!.length - 1].label).toBe('Close');
  });
});
