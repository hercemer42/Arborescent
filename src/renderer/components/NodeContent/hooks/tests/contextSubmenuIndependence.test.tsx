import { describe, it, expect, vi } from 'vitest';
import { buildExecuteSubmenu } from '../useExecuteSubmenu';
import { buildCollaborateSubmenu } from '../useCollaborateSubmenu';
import { TreeNode } from '../../../../../shared/types';
import { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

describe('Execute and Collaborate submenu unified context', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  const createContextDeclaration = (nodeId: string, content: string): ContextDeclarationInfo => ({
    nodeId,
    content,
    icon: 'lightbulb',
  });

  it('should show same context selected in both Execute and Collaborate', () => {
    const node = createNode('task', {
      appliedContextId: 'ctx-unified',
    });
    const nodes = {
      'task': node,
      'ctx-unified': createNode('ctx-unified', { isContextDeclaration: true }),
      'ctx-other': createNode('ctx-other', { isContextDeclaration: true }),
    };
    const contextDeclarations = [
      createContextDeclaration('ctx-unified', 'Unified Context'),
      createContextDeclaration('ctx-other', 'Other Context'),
    ];
    const ancestorRegistry = { 'task': [] };

    const executeMenu = buildExecuteSubmenu({
      node,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onExecuteInBrowser: vi.fn(),
      onExecuteInTerminal: vi.fn(),
      onSetActiveContext: vi.fn(),
    });

    const collaborateMenu = buildCollaborateSubmenu({
      node,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onCollaborate: vi.fn(),
      onCollaborateInTerminal: vi.fn(),
      onSetActiveContext: vi.fn(),
    });

    // Find context items
    const executeCtxUnified = executeMenu.find(item => item.label === 'Unified Context');
    const executeCtxOther = executeMenu.find(item => item.label === 'Other Context');
    const collaborateCtxUnified = collaborateMenu.find(item => item.label === 'Unified Context');
    const collaborateCtxOther = collaborateMenu.find(item => item.label === 'Other Context');

    // Both menus should show ctx-unified as selected
    expect(executeCtxUnified?.radioSelected).toBe(true);
    expect(executeCtxOther?.radioSelected).toBe(false);
    expect(collaborateCtxUnified?.radioSelected).toBe(true);
    expect(collaborateCtxOther?.radioSelected).toBe(false);
  });

  it('should share selection when context is set via appliedContextId', () => {
    const node = createNode('task', {
      appliedContextId: 'ctx-a',
    });
    const nodes = {
      'task': node,
      'ctx-a': createNode('ctx-a', { isContextDeclaration: true }),
      'ctx-b': createNode('ctx-b', { isContextDeclaration: true }),
    };
    const contextDeclarations = [
      createContextDeclaration('ctx-a', 'Context A'),
      createContextDeclaration('ctx-b', 'Context B'),
    ];
    const ancestorRegistry = { 'task': [] };

    const executeMenu = buildExecuteSubmenu({
      node,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onExecuteInBrowser: vi.fn(),
      onExecuteInTerminal: vi.fn(),
      onSetActiveContext: vi.fn(),
    });

    const collaborateMenu = buildCollaborateSubmenu({
      node,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onCollaborate: vi.fn(),
      onCollaborateInTerminal: vi.fn(),
      onSetActiveContext: vi.fn(),
    });

    // Both: ctx-a selected
    const executeCtxA = executeMenu.find(item => item.label === 'Context A');
    const collaborateCtxA = collaborateMenu.find(item => item.label === 'Context A');
    expect(executeCtxA?.radioSelected).toBe(true);
    expect(collaborateCtxA?.radioSelected).toBe(true);
  });

  it('should inherit same context selection in both menus from ancestor', () => {
    const childNode = createNode('child-task');
    const parentNode = createNode('parent', {
      appliedContextId: 'ctx-parent',
    });
    const nodes = {
      'child-task': childNode,
      'parent': parentNode,
      'ctx-parent': createNode('ctx-parent', { isContextDeclaration: true }),
    };
    const contextDeclarations = [
      createContextDeclaration('ctx-parent', 'Parent Context'),
    ];
    const ancestorRegistry = {
      'child-task': ['parent'],
      'parent': [],
    };

    const executeMenu = buildExecuteSubmenu({
      node: childNode,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onExecuteInBrowser: vi.fn(),
      onExecuteInTerminal: vi.fn(),
      onSetActiveContext: vi.fn(),
    });

    const collaborateMenu = buildCollaborateSubmenu({
      node: childNode,
      nodes,
      ancestorRegistry,
      contextDeclarations,
      onCollaborate: vi.fn(),
      onCollaborateInTerminal: vi.fn(),
      onSetActiveContext: vi.fn(),
    });

    // Both menus should inherit and show the parent's context as selected
    const executeParentCtx = executeMenu.find(item => item.label?.includes('Parent Context'));
    const collaborateParentCtx = collaborateMenu.find(item => item.label?.includes('Parent Context'));
    expect(executeParentCtx?.radioSelected).toBe(true);
    expect(collaborateParentCtx?.radioSelected).toBe(true);
  });
});
