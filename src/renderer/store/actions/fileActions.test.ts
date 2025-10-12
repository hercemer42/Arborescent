import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFileActions } from './fileActions';
import type { TreeNode, NodeTypeConfig } from '@shared/types';

vi.mock('../../services/fileService', () => ({
  loadFile: vi.fn(),
  saveFile: vi.fn(),
}));

vi.mock('../../data/defaultTemplate', () => ({
  defaultNodeTypeConfig: {
    project: { icon: '📁', style: '' },
    task: { icon: '✓', style: '' },
  },
}));

import { loadFile, saveFile } from '../../services/fileService';
import { defaultNodeTypeConfig } from '../../data/defaultTemplate';

describe('fileActions', () => {
  let state: { nodes: Record<string, TreeNode>; rootNodeId: string; nodeTypeConfig: Record<string, NodeTypeConfig> };
  let setState: (partial: Partial<typeof state>) => void;
  let actions: ReturnType<typeof createFileActions>;

  beforeEach(() => {
    vi.clearAllMocks();

    state = {
      nodes: {
        'root': {
          id: 'root',
          type: 'project',
          content: 'Test Project',
          children: [],
          metadata: {},
        },
      },
      rootNodeId: 'root',
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
      },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createFileActions(
      () => state,
      setState
    );
  });

  describe('loadDocument', () => {
    it('should load document with nodes, rootNodeId, and config', () => {
      const newNodes = {
        'new-root': {
          id: 'new-root',
          type: 'project',
          content: 'New Project',
          children: [],
          metadata: {},
        },
      };
      const newConfig = {
        project: { icon: '🚀', style: '' },
      };

      actions.loadDocument(newNodes, 'new-root', newConfig);

      expect(state.nodes).toEqual(newNodes);
      expect(state.rootNodeId).toBe('new-root');
      expect(state.nodeTypeConfig).toEqual(newConfig);
    });
  });

  describe('loadFromPath', () => {
    it('should load file and update state', async () => {
      const mockData = {
        format: 'Arborescent' as const,
        version: '1.0.0',
        created: '2025-01-01',
        updated: '2025-01-02',
        author: 'Test',
        rootNodeId: 'loaded-root',
        nodes: {
          'loaded-root': {
            id: 'loaded-root',
            type: 'project',
            content: 'Loaded Project',
            children: [],
            metadata: {},
          },
        },
        nodeTypeConfig: {
          project: { icon: '📦', style: '' },
        },
      };

      vi.mocked(loadFile).mockResolvedValue(mockData);

      const result = await actions.loadFromPath('/test/path.arbo');

      expect(loadFile).toHaveBeenCalledWith('/test/path.arbo');
      expect(state.nodes).toEqual(mockData.nodes);
      expect(state.rootNodeId).toBe('loaded-root');
      expect(state.nodeTypeConfig).toEqual(mockData.nodeTypeConfig);
      expect(result).toEqual({ created: mockData.created, author: mockData.author });
    });

    it('should use default config when nodeTypeConfig is empty', async () => {
      const mockData = {
        format: 'Arborescent' as const,
        version: '1.0.0',
        created: '2025-01-01',
        updated: '2025-01-02',
        author: 'Test',
        rootNodeId: 'root',
        nodes: {},
        nodeTypeConfig: {},
      };

      vi.mocked(loadFile).mockResolvedValue(mockData);

      await actions.loadFromPath('/test/path.arbo');

      expect(state.nodeTypeConfig).toEqual(defaultNodeTypeConfig);
    });

    it('should use default config when nodeTypeConfig is undefined', async () => {
      const mockData = {
        format: 'Arborescent' as const,
        version: '1.0.0',
        created: '2025-01-01',
        updated: '2025-01-02',
        author: 'Test',
        rootNodeId: 'root',
        nodes: {},
      };

      vi.mocked(loadFile).mockResolvedValue(mockData);

      await actions.loadFromPath('/test/path.arbo');

      expect(state.nodeTypeConfig).toEqual(defaultNodeTypeConfig);
    });
  });

  describe('saveToPath', () => {
    it('should save file with current state', async () => {
      vi.mocked(saveFile).mockResolvedValue();

      await actions.saveToPath('/test/save.arbo');

      expect(saveFile).toHaveBeenCalledWith(
        '/test/save.arbo',
        state.nodes,
        state.rootNodeId,
        state.nodeTypeConfig,
        undefined
      );
    });

    it('should save file with metadata', async () => {
      vi.mocked(saveFile).mockResolvedValue();

      const meta = { created: '2025-01-01', author: 'Test User' };
      await actions.saveToPath('/test/save.arbo', meta);

      expect(saveFile).toHaveBeenCalledWith(
        '/test/save.arbo',
        state.nodes,
        state.rootNodeId,
        state.nodeTypeConfig,
        meta
      );
    });
  });
});
