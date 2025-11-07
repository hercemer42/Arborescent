import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { ArboFile, TreeNode } from '../../../shared/types';

/**
 * Integration Test: File Save/Load Round Trip
 *
 * Tests the complete data flow:
 * 1. User creates nodes in the tree
 * 2. User saves file to disk
 * 3. User closes the app
 * 4. User reopens the app
 * 5. Content matches exactly what was saved
 *
 * Systems tested:
 * - Tree store → filesStore → Storage service → IPC → Main process → Filesystem
 * - Filesystem → Main process → IPC → Storage service → filesStore → Tree store
 */
describe('Integration: File Save/Load', () => {
  const mockFilePath = '/test/documents/test.json';
  let savedData: ArboFile | null = null;

  beforeEach(() => {
    // Clear all stores
    useFilesStore.setState({ files: [], activeFilePath: null });
    storeManager['stores'].clear();
    savedData = null;

    // Mock IPC calls - but keep data flow realistic
    vi.mocked(window.electron.writeFile).mockImplementation(async (_path, content) => {
      savedData = JSON.parse(content);
    });

    vi.mocked(window.electron.readFile).mockImplementation(async () => {
      if (!savedData) throw new Error('No file saved yet');
      return JSON.stringify(savedData);
    });

    vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(null);
    vi.mocked(window.electron.getSession).mockResolvedValue(null);
  });

  it('should preserve all node data through save/load cycle', async () => {
    // === SETUP: Create a document with nodes ===
    const rootNode: TreeNode = {
      id: 'root',
      content: 'Project Root',
      children: ['child-1', 'child-2'],
      metadata: {},
    };

    const child1: TreeNode = {
      id: 'child-1',
      content: 'First Task',
      children: ['child-1-1'],
      metadata: { status: 'completed' },
    };

    const child1_1: TreeNode = {
      id: 'child-1-1',
      content: 'Subtask with details',
      children: [],
      metadata: { notes: 'Important details here' },
    };

    const child2: TreeNode = {
      id: 'child-2',
      content: 'Second Task',
      children: [],
      metadata: { status: 'pending' },
    };

    const nodes: Record<string, TreeNode> = {
      'root': rootNode,
      'child-1': child1,
      'child-1-1': child1_1,
      'child-2': child2,
    };

    // === STEP 1: Initialize store with document ===
    const store = storeManager.getStoreForFile(mockFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(mockFilePath);

    // === STEP 2: Save the document ===
    await store.getState().actions.saveToPath(mockFilePath);

    // Verify data was saved
    expect(savedData).not.toBeNull();
    expect(savedData?.format).toBe('Arborescent');
    expect(savedData?.rootNodeId).toBe('root');
    expect(Object.keys(savedData?.nodes || {})).toHaveLength(4);

    // === STEP 3: Simulate app restart - clear all state ===
    storeManager['stores'].clear();
    const freshStore = storeManager.getStoreForFile(mockFilePath);

    // === STEP 4: Load the document ===
    await freshStore.getState().actions.loadFromPath(mockFilePath);

    // === STEP 5: Verify all data is preserved ===
    const loadedState = freshStore.getState();
    const loadedNodes = loadedState.nodes;

    // Check root node
    expect(loadedNodes['root']).toBeDefined();
    expect(loadedNodes['root'].content).toBe('Project Root');
    expect(loadedNodes['root'].children).toEqual(['child-1', 'child-2']);

    // Check child with status
    expect(loadedNodes['child-1']).toBeDefined();
    expect(loadedNodes['child-1'].content).toBe('First Task');
    expect(loadedNodes['child-1'].metadata?.status).toBe('completed');

    // Check nested child with metadata
    expect(loadedNodes['child-1-1']).toBeDefined();
    expect(loadedNodes['child-1-1'].content).toBe('Subtask with details');
    expect(loadedNodes['child-1-1'].metadata?.notes).toBe('Important details here');

    // Check second child
    expect(loadedNodes['child-2']).toBeDefined();
    expect(loadedNodes['child-2'].content).toBe('Second Task');
    expect(loadedNodes['child-2'].metadata?.status).toBe('pending');
  });

  it('should preserve tree structure through save/load cycle', async () => {
    // Create a more complex tree to test structure preservation
    const nodes: Record<string, TreeNode> = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['a', 'b'],
        metadata: {},
      },
      'a': {
        id: 'a',
        content: 'Branch A',
        children: ['a1', 'a2', 'a3'],
        metadata: {},
      },
      'b': {
        id: 'b',
        content: 'Branch B',
        children: ['b1'],
        metadata: {},
      },
      'a1': { id: 'a1', content: 'A1', children: [], metadata: {} },
      'a2': { id: 'a2', content: 'A2', children: [], metadata: {} },
      'a3': { id: 'a3', content: 'A3', children: [], metadata: {} },
      'b1': { id: 'b1', content: 'B1', children: [], metadata: {} },
    };

    const store = storeManager.getStoreForFile(mockFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(mockFilePath);

    // Save
    await store.getState().actions.saveToPath(mockFilePath);

    // Reload
    storeManager['stores'].clear();
    const freshStore = storeManager.getStoreForFile(mockFilePath);
    await freshStore.getState().actions.loadFromPath(mockFilePath);

    // Verify structure
    const loadedNodes = freshStore.getState().nodes;
    expect(loadedNodes['root'].children).toEqual(['a', 'b']);
    expect(loadedNodes['a'].children).toEqual(['a1', 'a2', 'a3']);
    expect(loadedNodes['b'].children).toEqual(['b1']);
    expect(loadedNodes['a1'].children).toEqual([]);
  });

  it('should handle empty nodes gracefully', async () => {
    const nodes: Record<string, TreeNode> = {
      'root': {
        id: 'root',
        content: '',
        children: ['child'],
        metadata: {},
      },
      'child': {
        id: 'child',
        content: '',
        children: [],
        metadata: {},
      },
    };

    const store = storeManager.getStoreForFile(mockFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(mockFilePath);

    await store.getState().actions.saveToPath(mockFilePath);

    storeManager['stores'].clear();
    const freshStore = storeManager.getStoreForFile(mockFilePath);
    await freshStore.getState().actions.loadFromPath(mockFilePath);

    const loadedNodes = freshStore.getState().nodes;
    expect(loadedNodes['root'].content).toBe('');
    expect(loadedNodes['child'].content).toBe('');
  });

  it('should preserve metadata fields through save/load', async () => {
    const nodes: Record<string, TreeNode> = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['node'],
        metadata: {},
      },
      'node': {
        id: 'node',
        content: 'Node with metadata',
        children: [],
        metadata: {
          status: 'completed',
          customField: 'custom value',
          nestedObject: {
            key: 'value',
          },
        },
      },
    };

    const store = storeManager.getStoreForFile(mockFilePath);
    store.getState().actions.initialize(nodes, 'root');
    store.getState().actions.setFilePath(mockFilePath);

    await store.getState().actions.saveToPath(mockFilePath);

    storeManager['stores'].clear();
    const freshStore = storeManager.getStoreForFile(mockFilePath);
    await freshStore.getState().actions.loadFromPath(mockFilePath);

    const loadedNode = freshStore.getState().nodes['node'];
    expect(loadedNode.metadata?.status).toBe('completed');
    expect(loadedNode.metadata?.customField).toBe('custom value');
    expect(loadedNode.metadata?.nestedObject).toEqual({ key: 'value' });
  });
});
