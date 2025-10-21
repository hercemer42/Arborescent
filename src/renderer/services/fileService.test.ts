import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadFile, saveFile } from './fileService';
import type { ArboFile } from '../../shared/types';

describe('fileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.window.electron = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      onMenuOpen: vi.fn(),
      onMenuSave: vi.fn(),
      onMenuSaveAs: vi.fn(),
      onMainError: vi.fn(),
    };
  });

  describe('saveFile', () => {
    it('should save file with correct format', async () => {
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      window.electron.writeFile = mockWriteFile;

      const nodes = {
        'node-1': {
          id: 'node-1',
          content: 'Test',
          children: [],
          metadata: {},
        },
      };

      await saveFile('/test/path.arbo', nodes, 'node-1');

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/path.arbo',
        expect.stringContaining('"format": "Arborescent"')
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/path.arbo',
        expect.stringContaining('"version": "1.0.0"')
      );
    });

    it('should use existing metadata when provided', async () => {
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      window.electron.writeFile = mockWriteFile;

      const existingMeta = {
        created: '2025-01-01T00:00:00.000Z',
        author: 'Test Author',
      };

      await saveFile('/test/path.arbo', {}, 'root', existingMeta);

      const callArg = mockWriteFile.mock.calls[0][1] as string;
      const savedData = JSON.parse(callArg);

      expect(savedData.created).toBe('2025-01-01T00:00:00.000Z');
      expect(savedData.author).toBe('Test Author');
    });

    it('should generate new metadata when not provided', async () => {
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      window.electron.writeFile = mockWriteFile;

      await saveFile('/test/path.arbo', {}, 'root');

      const callArg = mockWriteFile.mock.calls[0][1] as string;
      const savedData = JSON.parse(callArg);

      expect(savedData.created).toBeDefined();
      expect(savedData.updated).toBeDefined();
      expect(savedData.author).toBe('unknown');
    });
  });

  describe('loadFile', () => {
    it('should load and parse valid Arborescent file', async () => {
      const validFile: ArboFile = {
        format: 'Arborescent',
        version: '1.0.0',
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-02T00:00:00.000Z',
        author: 'Test',
        rootNodeId: 'root',
        nodes: {
          'root': {
            id: 'root',
            content: 'Test Project',
            children: [],
            metadata: {},
          },
        },
      };

      const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify(validFile));
      window.electron.readFile = mockReadFile;

      const result = await loadFile('/test/path.arbo');

      expect(mockReadFile).toHaveBeenCalledWith('/test/path.arbo');
      expect(result).toEqual(validFile);
    });

    it('should throw error for invalid JSON', async () => {
      const mockReadFile = vi.fn().mockResolvedValue('invalid json {{{');
      window.electron.readFile = mockReadFile;

      await expect(loadFile('/test/path.arbo')).rejects.toThrow();
    });

    it('should throw error for invalid file format', async () => {
      const invalidFile = {
        format: 'WrongFormat',
        version: '1.0.0',
        nodes: {},
      };

      const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify(invalidFile));
      window.electron.readFile = mockReadFile;

      await expect(loadFile('/test/path.arbo')).rejects.toThrow('Invalid file format');
    });

    it('should throw error when format field is missing', async () => {
      const invalidFile = {
        version: '1.0.0',
        nodes: {},
      };

      const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify(invalidFile));
      window.electron.readFile = mockReadFile;

      await expect(loadFile('/test/path.arbo')).rejects.toThrow('Invalid file format');
    });

    it('should handle file read errors', async () => {
      const mockReadFile = vi.fn().mockRejectedValue(new Error('File not found'));
      window.electron.readFile = mockReadFile;

      await expect(loadFile('/test/path.arbo')).rejects.toThrow('File not found');
    });
  });
});
