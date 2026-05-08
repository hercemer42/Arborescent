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
      { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', collaborate: true, execute: false as const },
      { nodeId: 'exec-ctx', content: 'My Script', icon: 'zap', collaborate: true, execute: true as const },
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

    it('renders section headers in order: Actions, Execute, Collaborate, Execute & Collaborate', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'act-ctx', content: 'Just An Action', icon: 'star', collaborate: false, execute: false },
          { nodeId: 'exec-only-ctx', content: 'Pure Exec', icon: 'zap', collaborate: false, execute: true },
          { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', collaborate: true, execute: false },
          { nodeId: 'both-ctx', content: 'Both Flags', icon: 'zap', collaborate: true, execute: true },
        ] as ContextDeclarationInfo[],
        nodes: {
          'target-node': createNode('target-node'),
          'act-ctx': createNode('act-ctx', { isContextDeclaration: true }),
          'exec-only-ctx': createNode('exec-only-ctx', { isContextDeclaration: true }),
          'collab-ctx': createNode('collab-ctx', { isContextDeclaration: true }),
          'both-ctx': createNode('both-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root'],
          'act-ctx': ['root'],
          'exec-only-ctx': ['root'],
          'collab-ctx': ['root'],
          'both-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const order = ['Actions', 'Execute', 'Collaborate', 'Execute & Collaborate'];
      const indices = order.map(h => labels.indexOf(h));
      indices.forEach(idx => expect(idx).toBeGreaterThan(-1));
      const sorted = [...indices].sort((a, b) => a - b);
      expect(indices).toEqual(sorted);
    });

    it('contains a disabled "Actions" header when an actions context exists', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'act-ctx', content: 'Just An Action', icon: 'star', collaborate: false, execute: false },
        ] as ContextDeclarationInfo[],
        nodes: {
          'target-node': createNode('target-node'),
          'act-ctx': createNode('act-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root'],
          'act-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const header = result!.find(item => item.label === 'Actions');
      expect(header).toBeDefined();
      expect(header?.disabled).toBe(true);
    });

    it('contains a disabled "Execute & Collaborate" header when a both-flags context exists', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'both-ctx', content: 'Both Flags', icon: 'zap', collaborate: true, execute: true },
        ] as ContextDeclarationInfo[],
        nodes: {
          'target-node': createNode('target-node'),
          'both-ctx': createNode('both-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root'],
          'both-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const header = result!.find(item => item.label === 'Execute & Collaborate');
      expect(header).toBeDefined();
      expect(header?.disabled).toBe(true);
    });

    it('omits the Actions header when no actions context exists', () => {
      const result = buildSetContextSubmenu(defaultParams());
      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      expect(labels).not.toContain('Actions');
    });

    it('omits the Execute & Collaborate header when no both-flags context exists', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', collaborate: true, execute: false },
        ] as ContextDeclarationInfo[],
      }));
      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      expect(labels).not.toContain('Execute & Collaborate');
    });
  });

  const fourFlagFixture = () => ({
    contextDeclarations: [
      { nodeId: 'act-ctx', content: 'Just An Action', icon: 'star', collaborate: false, execute: false },
      { nodeId: 'exec-only-ctx', content: 'Pure Exec', icon: 'zap', collaborate: false, execute: true },
      { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', collaborate: true, execute: false },
      { nodeId: 'both-ctx', content: 'Both Flags', icon: 'zap', collaborate: true, execute: true },
    ] as ContextDeclarationInfo[],
    nodes: {
      'target-node': createNode('target-node'),
      'act-ctx': createNode('act-ctx', { isContextDeclaration: true }),
      'exec-only-ctx': createNode('exec-only-ctx', { isContextDeclaration: true }),
      'collab-ctx': createNode('collab-ctx', { isContextDeclaration: true }),
      'both-ctx': createNode('both-ctx', { isContextDeclaration: true }),
    },
    ancestorRegistry: {
      'target-node': ['root'],
      'act-ctx': ['root'],
      'exec-only-ctx': ['root'],
      'collab-ctx': ['root'],
      'both-ctx': ['root'],
      'root': [],
    } as Record<string, string[]>,
  });

  function appearsBetweenHeaders(labels: (string | undefined)[], target: string, afterHeader: string, beforeHeader: string): boolean {
    const targetIdx = labels.indexOf(target);
    const afterIdx = labels.indexOf(afterHeader);
    if (targetIdx <= afterIdx) return false;
    const beforeIdx = labels.indexOf(beforeHeader);
    if (beforeIdx === -1) return true;
    return targetIdx < beforeIdx;
  }

  describe('custom context grouping', () => {
    it('places a context with collaborate=false, execute=false under Actions section', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      expect(appearsBetweenHeaders(labels, 'Just An Action', 'Actions', 'Execute')).toBe(true);
    });

    it('places a context with collaborate=false, execute=true under Execute section', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      expect(appearsBetweenHeaders(labels, 'Pure Exec', 'Execute', 'Collaborate')).toBe(true);
    });

    it('places a context with collaborate=true, execute=false under Collaborate section', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      expect(appearsBetweenHeaders(labels, 'My Review', 'Collaborate', 'Execute & Collaborate')).toBe(true);
    });

    it('places a context with collaborate=true, execute=true under Execute & Collaborate section, not Execute', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const bothIdx = labels.indexOf('Both Flags');
      const execAndCollabIdx = labels.indexOf('Execute & Collaborate');
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const execHeaderIdx = labels.indexOf('Execute');

      expect(bothIdx).toBeGreaterThan(execAndCollabIdx);
      expect(bothIdx).toBeGreaterThan(collabHeaderIdx);
      expect(bothIdx).toBeGreaterThan(execHeaderIdx);
      expect(labels.lastIndexOf('Both Flags')).toBe(bothIdx);
    });

    it('does not place a both-flags context under Execute', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'exec-only-ctx', content: 'Pure Exec', icon: 'zap', collaborate: false, execute: true },
          { nodeId: 'both-ctx', content: 'Both Flags', icon: 'zap', collaborate: true, execute: true },
        ] as ContextDeclarationInfo[],
        nodes: {
          'target-node': createNode('target-node'),
          'exec-only-ctx': createNode('exec-only-ctx', { isContextDeclaration: true }),
          'both-ctx': createNode('both-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root'],
          'exec-only-ctx': ['root'],
          'both-ctx': ['root'],
          'root': [],
        },
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const execHeaderIdx = labels.indexOf('Execute');
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const execAndCollabIdx = labels.indexOf('Execute & Collaborate');

      const beforeNextSection = collabHeaderIdx === -1 ? execAndCollabIdx : collabHeaderIdx;
      const executeSection = labels.slice(execHeaderIdx + 1, beforeNextSection);
      expect(executeSection).not.toContain('Both Flags');
    });

    it('shows custom context (My Review) under the Collaborate section in the default fixture', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const myReviewIdx = labels.indexOf('My Review');
      const execAndCollabIdx = labels.indexOf('Execute & Collaborate');

      expect(myReviewIdx).toBeGreaterThan(collabHeaderIdx);
      if (execAndCollabIdx !== -1) {
        expect(myReviewIdx).toBeLessThan(execAndCollabIdx);
      }
    });

    it('shows the both-flags exec-ctx under Execute & Collaborate (default fixture)', () => {
      const result = buildSetContextSubmenu(defaultParams());

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const execAndCollabIdx = labels.indexOf('Execute & Collaborate');
      const myScriptIdx = labels.indexOf('My Script');

      expect(execAndCollabIdx).toBeGreaterThan(-1);
      expect(myScriptIdx).toBeGreaterThan(execAndCollabIdx);
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

    it('applies an Actions-section context (both flags false) on click', () => {
      const onSetAppliedContext = vi.fn();
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'act-ctx', content: 'Just An Action', icon: 'star', collaborate: false, execute: false },
        ] as ContextDeclarationInfo[],
        nodes: {
          'target-node': createNode('target-node'),
          'act-ctx': createNode('act-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: {
          'target-node': ['root'],
          'act-ctx': ['root'],
          'root': [],
        },
        onSetAppliedContext,
      }));

      const actionItem = result!.find(item => item.label === 'Just An Action');
      expect(actionItem).toBeDefined();
      actionItem?.onClick?.();

      expect(onSetAppliedContext).toHaveBeenCalledWith('act-ctx');
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
          { nodeId: 'collab-ctx', content: 'Hidden', icon: 'star', collaborate: true, execute: false as const },
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

    it('Execute section contains only "Basic execution" when no user execute-only contexts exist', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'collab-ctx', content: 'My Review', icon: 'star', collaborate: true, execute: false as const },
        ] as ContextDeclarationInfo[],
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const execHeaderIdx = labels.indexOf('Execute');
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const sectionEnd = collabHeaderIdx !== -1 ? collabHeaderIdx : labels.indexOf('Close');
      const itemsBetween = labels.slice(execHeaderIdx + 1, sectionEnd).filter(l => l !== undefined);
      expect(itemsBetween).toEqual(['Basic execution']);
    });

    it('Collaborate section contains only "Basic review" when no user collaborate-only contexts exist', () => {
      const result = buildSetContextSubmenu(defaultParams({
        contextDeclarations: [
          { nodeId: 'exec-ctx', content: 'My Script', icon: 'zap', collaborate: true, execute: true as const },
        ] as ContextDeclarationInfo[],
      }));

      expect(result).not.toBeNull();
      const labels = result!.map(item => item.label);
      const collabHeaderIdx = labels.indexOf('Collaborate');
      const execAndCollabIdx = labels.indexOf('Execute & Collaborate');
      const sectionEnd = execAndCollabIdx !== -1 ? execAndCollabIdx : labels.indexOf('Close');
      const itemsBetween = labels.slice(collabHeaderIdx + 1, sectionEnd).filter(l => l !== undefined);
      expect(itemsBetween).toEqual(['Basic review']);
    });
  });

  describe('separator placement', () => {
    it('does not start with a separator', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));
      expect(result).not.toBeNull();
      expect(result![0].separator).not.toBe(true);
    });

    it('does not end with a separator (Close is last, no separator immediately before it)', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));
      expect(result).not.toBeNull();
      expect(result![result!.length - 1].label).toBe('Close');
      expect(result![result!.length - 2]?.separator).not.toBe(true);
    });

    it('never has two consecutive separators', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));
      expect(result).not.toBeNull();
      for (let i = 1; i < result!.length; i++) {
        const prev = result![i - 1].separator === true;
        const curr = result![i].separator === true;
        expect(prev && curr).toBe(false);
      }
    });

    it('renders a separator between Actions and Execute when both are present', () => {
      const result = buildSetContextSubmenu(defaultParams(fourFlagFixture()));
      expect(result).not.toBeNull();
      const actionsIdx = result!.findIndex(item => item.label === 'Actions');
      const executeIdx = result!.findIndex(item => item.label === 'Execute');
      expect(actionsIdx).toBeGreaterThan(-1);
      expect(executeIdx).toBeGreaterThan(actionsIdx);
      const separatorsBetween = result!
        .slice(actionsIdx + 1, executeIdx)
        .filter(item => item.separator === true);
      expect(separatorsBetween.length).toBe(1);
    });
  });

  it('should truncate long context names', () => {
    const longName = 'A'.repeat(50);
    const result = buildSetContextSubmenu(defaultParams({
      contextDeclarations: [
        { nodeId: 'collab-ctx', content: longName, icon: 'star', collaborate: true, execute: false as const },
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
