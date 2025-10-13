import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFileActions } from './fileActions';
import type { TreeNode, NodeTypeConfig, ArboFile } from '@shared/types';
import type { StorageService } from '@shared/interfaces';

vi.mock('../../data/defaultTemplate', () => ({
  defaultNodeTypeConfig: {
    project: { icon: '📁', style: '' },
    task: { icon: '✓', style: '' },
  },
}));

import { defaultNodeTypeConfig } from '../../../data/defaultTemplate';

describe('fileActions', () => {
  let state: { nodes: Record<string, TreeNode>; rootNodeId: string; nodeTypeConfig: Record<string, NodeTypeConfig> };
  let setState: (partial: Partial<typeof state>) => void;
  let actions: ReturnType<typeof createFileActions>;
  let mockStorage: StorageService;

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

    mockStorage = {
      loadDocument: vi.fn(),
      saveDocument: vi.fn(),
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      saveLastSession: vi.fn(),
      getLastSession: vi.fn(),
    };

    actions = createFileActions(
      () => state,
      setState,
      mockStorage
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

      vi.mocked(mockStorage.loadDocument).mockResolvedValue(mockData);

      const result = await actions.loadFromPath('/test/path.arbo');

      expect(mockStorage.loadDocument).toHaveBeenCalledWith('/test/path.arbo');
      expect(state.nodes).toEqual(mockData.nodes);
      expect(state.rootNodeId).toBe('loaded-root');
      expect(state.nodeTypeConfig).toEqual(mockData.nodeTypeConfig);
      expect(result).toEqual({ created: mockData.created, author: mockData.author });
    });

    it('should save session after loading file', async () => {
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

      vi.mocked(mockStorage.loadDocument).mockResolvedValue(mockData);

      await actions.loadFromPath('/test/path.arbo');

      expect(mockStorage.saveLastSession).toHaveBeenCalledWith('/test/path.arbo');
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

      vi.mocked(mockStorage.loadDocument).mockResolvedValue(mockData);

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
      } as ArboFile;

      vi.mocked(mockStorage.loadDocument).mockResolvedValue(mockData);

      await actions.loadFromPath('/test/path.arbo');

      expect(state.nodeTypeConfig).toEqual(defaultNodeTypeConfig);
    });
  });

  describe('saveToPath', () => {
    it('should save file with current state', async () => {
      vi.mocked(mockStorage.saveDocument).mockResolvedValue();

      await actions.saveToPath('/test/save.arbo');

      expect(mockStorage.saveDocument).toHaveBeenCalledWith(
        '/test/save.arbo',
        expect.objectContaining({
          format: 'Arborescent',
          nodes: state.nodes,
          rootNodeId: state.rootNodeId,
          nodeTypeConfig: state.nodeTypeConfig,
        })
      );
    });

    it('should save session after saving file', async () => {
      vi.mocked(mockStorage.saveDocument).mockResolvedValue();

      await actions.saveToPath('/test/save.arbo');

      expect(mockStorage.saveLastSession).toHaveBeenCalledWith('/test/save.arbo');
    });

    it('should save file with metadata', async () => {
      vi.mocked(mockStorage.saveDocument).mockResolvedValue();

      const meta = { created: '2025-01-01', author: 'Test User' };
      await actions.saveToPath('/test/save.arbo', meta);

      expect(mockStorage.saveDocument).toHaveBeenCalledWith(
        '/test/save.arbo',
        expect.objectContaining({
          format: 'Arborescent',
          created: meta.created,
          author: meta.author,
          nodes: state.nodes,
          rootNodeId: state.rootNodeId,
          nodeTypeConfig: state.nodeTypeConfig,
        })
      );
    });
  });
});
