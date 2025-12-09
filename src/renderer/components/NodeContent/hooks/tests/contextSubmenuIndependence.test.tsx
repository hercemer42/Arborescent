import { describe, it, expect, vi } from 'vitest';
import { buildExecuteSubmenu } from '../useExecuteSubmenu';
import { buildCollaborateSubmenu } from '../useCollaborateSubmenu';
import { TreeNode } from '../../../../../shared/types';
import { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

describe('Execute and Collaborate submenu independence', () => {
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

  it('should show different contexts as selected in Execute vs Collaborate', () => {
    const node = createNode('task', {
      activeExecuteContextId: 'ctx-exec',
      activeCollaborateContextId: 'ctx-collab',
    });
    const nodes = {
      'task': node,
      'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
      'ctx-collab': createNode('ctx-collab', { isContextDeclaration: true }),
    };
    const contextDeclarations = [
      createContextDeclaration('ctx-exec', 'Execute Context'),
      createContextDeclaration('ctx-collab', 'Collaborate Context'),
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

    // Find context items (after separator and heading)
    const executeCtxExec = executeMenu.find(item => item.label === 'Execute Context');
    const executeCtxCollab = executeMenu.find(item => item.label === 'Collaborate Context');
    const collaborateCtxExec = collaborateMenu.find(item => item.label === 'Execute Context');
    const collaborateCtxCollab = collaborateMenu.find(item => item.label === 'Collaborate Context');

    // In Execute menu: ctx-exec should be selected, ctx-collab should not
    expect(executeCtxExec?.radioSelected).toBe(true);
    expect(executeCtxCollab?.radioSelected).toBe(false);

    // In Collaborate menu: ctx-collab should be selected, ctx-exec should not
    expect(collaborateCtxExec?.radioSelected).toBe(false);
    expect(collaborateCtxCollab?.radioSelected).toBe(true);
  });

  it('should NOT share selection when only Execute has explicit context', () => {
    const node = createNode('task', {
      activeExecuteContextId: 'ctx-a',
      // No activeCollaborateContextId
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

    // Execute: ctx-a selected
    const executeCtxA = executeMenu.find(item => item.label === 'Context A');
    expect(executeCtxA?.radioSelected).toBe(true);

    // Collaborate: nothing selected (no explicit selection, no fallback)
    const collaborateCtxA = collaborateMenu.find(item => item.label === 'Context A');
    const collaborateCtxB = collaborateMenu.find(item => item.label === 'Context B');
    expect(collaborateCtxA?.radioSelected).toBe(false);
    expect(collaborateCtxB?.radioSelected).toBe(false);
  });
});
