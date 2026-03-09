import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TreeNode } from '../../../../../shared/types';
import { ContextDeclarationInfo } from '../../../../store/tree/treeStore';
import { buildSendSubmenu, SendSubmenuParams } from '../useSendSubmenu';
import { BASIC_EXECUTE_CONTEXT_ID } from '../../../../utils/nodeHelpers';

describe('buildSendSubmenu', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  const createContextDeclaration = (
    nodeId: string,
    content: string,
    icon = 'Lightbulb',
    mode: 'collaborate' | 'execute' = 'collaborate',
    color?: string,
  ): ContextDeclarationInfo => ({
    nodeId,
    content,
    icon,
    mode,
    color,
  });

  let defaultParams: SendSubmenuParams;

  beforeEach(() => {
    vi.clearAllMocks();
    const node = createNode('regular-node');
    defaultParams = {
      node,
      nodes: { 'regular-node': node },
      ancestorRegistry: { 'regular-node': [] },
      contextDeclarations: [],
      collaboratingNodeId: null,
      onSendInTerminal: vi.fn(),
      onSendInBrowser: vi.fn(),
      onSetActiveContext: vi.fn(),
    };
  });

  describe('base actions structure', () => {
    it('should show actions in order: In terminal, In browser', () => {
      const result = buildSendSubmenu(defaultParams);
      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
    });

    it('should enable actions when default context (Basic review) is selected', () => {
      const result = buildSendSubmenu(defaultParams);
      expect(result[0].disabled).toBeFalsy();
      expect(result[1].disabled).toBeFalsy();
    });

    it('should enable actions when an explicit context is applied', () => {
      const node = createNode('regular-node', { appliedContextId: 'ctx-1' });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true, contextMode: 'execute' });
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'regular-node': node, 'ctx-1': ctxNode },
        contextDeclarations,
      });
      expect(result[0].disabled).toBeFalsy();
      expect(result[1].disabled).toBeFalsy();
    });
  });

  describe('built-in default contexts', () => {
    it('should show "Basic review (default)" in the context picker', () => {
      const result = buildSendSubmenu(defaultParams);
      const basicReview = result.find(item => item.label === 'Basic review (default)');
      expect(basicReview).toBeDefined();
    });

    it('should show "Basic execution" in the context picker', () => {
      const result = buildSendSubmenu(defaultParams);
      const basicExecution = result.find(item => item.label === 'Basic execution');
      expect(basicExecution).toBeDefined();
    });

    it('should show "Basic review (default)" as selected when no context is applied', () => {
      const result = buildSendSubmenu(defaultParams);
      const basicReview = result.find(item => item.label === 'Basic review (default)');
      expect(basicReview?.radioSelected).toBe(true);
    });

    it('should show "Basic execution" as unselected when no context is applied', () => {
      const result = buildSendSubmenu(defaultParams);
      const basicExecution = result.find(item => item.label === 'Basic execution');
      expect(basicExecution?.radioSelected).toBe(false);
    });

    it('should show "Basic execution" as selected when BASIC_EXECUTE_CONTEXT_ID is applied', () => {
      const node = createNode('regular-node', { appliedContextId: BASIC_EXECUTE_CONTEXT_ID });
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'regular-node': node },
      });
      const basicExecution = result.find(item => item.label === 'Basic execution');
      expect(basicExecution?.radioSelected).toBe(true);
    });

    it('should call onSetActiveContext with BASIC_EXECUTE_CONTEXT_ID when clicking "Basic execution"', () => {
      const onSetActiveContext = vi.fn();
      const result = buildSendSubmenu({ ...defaultParams, onSetActiveContext });
      const basicExecution = result.find(item => item.label === 'Basic execution');
      basicExecution?.onClick?.();
      expect(onSetActiveContext).toHaveBeenCalledWith('regular-node', BASIC_EXECUTE_CONTEXT_ID);
    });

    it('should dispatch execute mode when "Basic execution" is selected and action is triggered', () => {
      const onSendInTerminal = vi.fn();
      const node = createNode('regular-node', { appliedContextId: BASIC_EXECUTE_CONTEXT_ID });
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'regular-node': node },
        onSendInTerminal,
      });
      result[0].onClick?.();
      expect(onSendInTerminal).toHaveBeenCalledWith('execute');
    });

    it('should show built-in contexts before user-declared contexts', () => {
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true, contextMode: 'collaborate' });
      const contextDeclarations = [createContextDeclaration('ctx-1', 'My Context')];
      const result = buildSendSubmenu({
        ...defaultParams,
        nodes: { ...defaultParams.nodes, 'ctx-1': ctxNode },
        contextDeclarations,
      });
      const basicReviewIdx = result.findIndex(item => item.label === 'Basic review (default)');
      const userCtxIdx = result.findIndex(item => item.label === 'My Context');
      expect(basicReviewIdx).toBeLessThan(userCtxIdx);
    });
  });

  describe('context grouping by mode', () => {
    it('should place "Basic review" under Collaborate heading and "Basic execution" under Execute heading', () => {
      const result = buildSendSubmenu(defaultParams);
      const items = result.map(item => item.label);
      const collaborateIdx = items.indexOf('Collaborate');
      const executeIdx = items.indexOf('Execute');
      const basicReviewIdx = items.indexOf('Basic review (default)');
      const basicExecutionIdx = items.indexOf('Basic execution');
      expect(collaborateIdx).toBeLessThan(basicReviewIdx);
      expect(basicReviewIdx).toBeLessThan(executeIdx);
      expect(executeIdx).toBeLessThan(basicExecutionIdx);
    });

    it('should group user-declared contexts under Collaborate and Execute headings', () => {
      const contextDeclarations = [
        createContextDeclaration('ctx-review', 'Code Review', 'Eye', 'collaborate'),
        createContextDeclaration('ctx-exec', 'Implement Feature', 'Wrench', 'execute'),
      ];
      const result = buildSendSubmenu({
        ...defaultParams,
        nodes: {
          ...defaultParams.nodes,
          'ctx-review': createNode('ctx-review', { isContextDeclaration: true }),
          'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
        },
        contextDeclarations,
      });
      const collaborateHeading = result.find(item => item.label === 'Collaborate' && item.disabled);
      const executeHeading = result.find(item => item.label === 'Execute' && item.disabled);
      expect(collaborateHeading).toBeDefined();
      expect(executeHeading).toBeDefined();
    });

    it('should show Collaborate heading with built-in even when no user-declared collaborate contexts exist', () => {
      const contextDeclarations = [
        createContextDeclaration('ctx-exec', 'Implement Feature', 'Wrench', 'execute'),
      ];
      const result = buildSendSubmenu({
        ...defaultParams,
        nodes: {
          ...defaultParams.nodes,
          'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
        },
        contextDeclarations,
      });
      const collaborateHeading = result.find(item => item.label === 'Collaborate' && item.disabled);
      expect(collaborateHeading).toBeDefined();
      const basicReview = result.find(item => item.label === 'Basic review (default)');
      expect(basicReview).toBeDefined();
    });

    it('should show Execute heading with built-in even when no user-declared execute contexts exist', () => {
      const contextDeclarations = [
        createContextDeclaration('ctx-review', 'Code Review', 'Eye', 'collaborate'),
      ];
      const result = buildSendSubmenu({
        ...defaultParams,
        nodes: {
          ...defaultParams.nodes,
          'ctx-review': createNode('ctx-review', { isContextDeclaration: true }),
        },
        contextDeclarations,
      });
      const executeHeading = result.find(item => item.label === 'Execute' && item.disabled);
      expect(executeHeading).toBeDefined();
      const basicExecution = result.find(item => item.label === 'Basic execution');
      expect(basicExecution).toBeDefined();
    });
  });

  describe('mode-based action dispatch', () => {
    it('should call onSendInTerminal with collaborate when default context is active', () => {
      const onSendInTerminal = vi.fn();
      const result = buildSendSubmenu({ ...defaultParams, onSendInTerminal });
      result[0].onClick?.();
      expect(onSendInTerminal).toHaveBeenCalledWith('collaborate');
    });

    it('should call onSendInTerminal with execute when execute context is applied', () => {
      const onSendInTerminal = vi.fn();
      const node = createNode('regular-node', { appliedContextId: 'ctx-exec' });
      const ctxNode = createNode('ctx-exec', { isContextDeclaration: true, contextMode: 'execute' });
      const contextDeclarations = [createContextDeclaration('ctx-exec', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'regular-node': node, 'ctx-exec': ctxNode },
        contextDeclarations,
        onSendInTerminal,
      });
      result[0].onClick?.();
      expect(onSendInTerminal).toHaveBeenCalledWith('execute');
    });

    it('should call onSendInBrowser with collaborate when default context is active', () => {
      const onSendInBrowser = vi.fn();
      const result = buildSendSubmenu({ ...defaultParams, onSendInBrowser });
      result[1].onClick?.();
      expect(onSendInBrowser).toHaveBeenCalledWith('collaborate');
    });

    it('should call onSendInBrowser with execute when execute context is applied', () => {
      const onSendInBrowser = vi.fn();
      const node = createNode('regular-node', { appliedContextId: 'ctx-exec' });
      const ctxNode = createNode('ctx-exec', { isContextDeclaration: true, contextMode: 'execute' });
      const contextDeclarations = [createContextDeclaration('ctx-exec', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'regular-node': node, 'ctx-exec': ctxNode },
        contextDeclarations,
        onSendInBrowser,
      });
      result[1].onClick?.();
      expect(onSendInBrowser).toHaveBeenCalledWith('execute');
    });

    it('should use inherited context mode when node has no explicit context', () => {
      const onSendInTerminal = vi.fn();
      const node = createNode('child-node');
      const parentNode = createNode('parent-node', { appliedContextId: 'ctx-exec' });
      const ctxNode = createNode('ctx-exec', { isContextDeclaration: true, contextMode: 'execute' });
      const contextDeclarations = [createContextDeclaration('ctx-exec', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'child-node': node, 'parent-node': parentNode, 'ctx-exec': ctxNode },
        ancestorRegistry: { 'child-node': ['parent-node'], 'parent-node': [] },
        contextDeclarations,
        onSendInTerminal,
      });
      result[0].onClick?.();
      expect(onSendInTerminal).toHaveBeenCalledWith('execute');
    });
  });

  describe('collaborate in-progress state', () => {
    it('should disable action triggers when collaboration is in progress and mode is collaborate', () => {
      const result = buildSendSubmenu({ ...defaultParams, collaboratingNodeId: 'some-other-node' });
      expect(result[0].disabled).toBe(true);
      expect(result[1].disabled).toBe(true);
    });

    it('should enable action triggers when collaboration is in progress but mode is execute', () => {
      const node = createNode('exec-node', { appliedContextId: 'ctx-exec' });
      const ctxNode = createNode('ctx-exec', { isContextDeclaration: true, contextMode: 'execute' });
      const contextDeclarations = [createContextDeclaration('ctx-exec', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'exec-node': node, 'ctx-exec': ctxNode },
        contextDeclarations,
        collaboratingNodeId: 'some-other-node',
      });
      expect(result[0].disabled).toBeFalsy();
      expect(result[1].disabled).toBeFalsy();
    });

    it('should keep context picker enabled even when action triggers are disabled', () => {
      const contextDeclarations = [createContextDeclaration('ctx-exec', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        nodes: {
          ...defaultParams.nodes,
          'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
        },
        contextDeclarations,
        collaboratingNodeId: 'some-other-node',
      });
      const ctxItem = result.find(item => item.label === 'Build');
      expect(ctxItem?.disabled).toBeFalsy();
    });
  });

  describe('context selection', () => {
    it('should call onSetActiveContext when clicking a non-active context', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { appliedContextId: 'ctx-1' });
      const contextDeclarations = [
        createContextDeclaration('ctx-1', 'Review', 'Eye', 'collaborate'),
        createContextDeclaration('ctx-2', 'Build', 'Wrench', 'execute'),
      ];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: {
          'task-node': node,
          'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
          'ctx-2': createNode('ctx-2', { isContextDeclaration: true }),
        },
        contextDeclarations,
        onSetActiveContext,
      });
      const buildItem = result.find(item => item.label === 'Build');
      buildItem?.onClick?.();
      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', 'ctx-2');
    });

    it('should call onSetActiveContext with null when clicking the active context', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { appliedContextId: 'ctx-1' });
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Review', 'Eye', 'collaborate')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: {
          'task-node': node,
          'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
        },
        contextDeclarations,
        onSetActiveContext,
      });
      const reviewItem = result.find(item => item.label === 'Review');
      reviewItem?.onClick?.();
      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', null);
    });

    it('should call onSetActiveContext with null when clicking "Basic review (default)"', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { appliedContextId: 'ctx-1' });
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Build', 'Wrench', 'execute')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: {
          'task-node': node,
          'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
        },
        contextDeclarations,
        onSetActiveContext,
      });
      const defaultItem = result.find(item => item.label === 'Basic review (default)');
      defaultItem?.onClick?.();
      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', null);
    });
  });

  describe('filtering', () => {
    it('should not show context if it is an ancestor of the node', () => {
      const contextDeclarations = [createContextDeclaration('ancestor-ctx', 'Ancestor Context')];
      const result = buildSendSubmenu({
        ...defaultParams,
        nodes: {
          ...defaultParams.nodes,
          'ancestor-ctx': createNode('ancestor-ctx', { isContextDeclaration: true }),
        },
        ancestorRegistry: { 'regular-node': ['ancestor-ctx'] },
        contextDeclarations,
      });
      const ancestorItem = result.find(item => item.label === 'Ancestor Context');
      expect(ancestorItem).toBeUndefined();
    });

    it('should not show context if it is the node itself', () => {
      const node = createNode('ctx-node', { isContextDeclaration: true });
      const contextDeclarations = [createContextDeclaration('ctx-node', 'Self Context')];
      const result = buildSendSubmenu({
        ...defaultParams,
        node,
        nodes: { 'ctx-node': node },
        contextDeclarations,
      });
      const selfItem = result.find(item => item.label === 'Self Context');
      expect(selfItem).toBeUndefined();
    });
  });
});
