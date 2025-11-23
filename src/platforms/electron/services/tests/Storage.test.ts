import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as yaml from 'js-yaml';
import { Storage } from '../Storage';
import { ArboFile } from '../../../../shared/types';
import { SessionState } from '../../../../shared/interfaces';

describe('Storage', () => {
  let storage: Storage;

  const mockArboFile: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: '2025-01-01T00:00:00.000Z',
    updated: '2025-01-01T00:00:00.000Z',
    author: 'Test User',
    rootNodeId: 'root',
    nodes: {
      'root': {
        id: 'root',
        content: 'Root',
        children: [],
        metadata: {},
      },
    },
  };

  beforeEach(() => {
    storage = new Storage();
    vi.clearAllMocks();
  });

  describe('loadDocument', () => {
    it('should load and parse document from file', async () => {
      const fileContent = yaml.dump(mockArboFile);
      vi.mocked(window.electron.readFile).mockResolvedValue(fileContent);

      const result = await storage.loadDocument('/path/to/file.arbo');

      expect(window.electron.readFile).toHaveBeenCalledWith('/path/to/file.arbo');
      expect(result).toEqual(mockArboFile);
    });

    it('should throw error for invalid file format', async () => {
      const invalidFile = { format: 'Unknown', version: '1.0.0' };
      vi.mocked(window.electron.readFile).mockResolvedValue(yaml.dump(invalidFile));

      await expect(storage.loadDocument('/path/to/file.arbo')).rejects.toThrow('Invalid file format');
    });

    it('should handle YAML parse errors', async () => {
      vi.mocked(window.electron.readFile).mockResolvedValue('invalid: yaml: {{{');

      await expect(storage.loadDocument('/path/to/file.arbo')).rejects.toThrow();
    });
  });

  describe('saveDocument', () => {
    it('should convert to YAML and save document to file', async () => {
      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);

      await storage.saveDocument('/path/to/file.arbo', mockArboFile);

      expect(window.electron.writeFile).toHaveBeenCalledWith(
        '/path/to/file.arbo',
        yaml.dump(mockArboFile, { indent: 2, lineWidth: -1 })
      );
    });

    it('should format YAML with 2-space indentation', async () => {
      vi.mocked(window.electron.writeFile).mockResolvedValue(undefined);

      await storage.saveDocument('/path/to/file.arbo', mockArboFile);

      const savedContent = vi.mocked(window.electron.writeFile).mock.calls[0][1];
      expect(savedContent).toContain('  '); // Should have indentation
      expect(savedContent).toContain('\n'); // Should have newlines
    });
  });

  describe('showOpenDialog', () => {
    it('should return file path from open dialog', async () => {
      vi.mocked(window.electron.showOpenDialog).mockResolvedValue('/selected/file.arbo');

      const result = await storage.showOpenDialog();

      expect(result).toBe('/selected/file.arbo');
      expect(window.electron.showOpenDialog).toHaveBeenCalled();
    });

    it('should return null when dialog is cancelled', async () => {
      vi.mocked(window.electron.showOpenDialog).mockResolvedValue(null);

      const result = await storage.showOpenDialog();

      expect(result).toBeNull();
    });
  });

  describe('showSaveDialog', () => {
    it('should return file path from save dialog', async () => {
      vi.mocked(window.electron.showSaveDialog).mockResolvedValue('/save/location.arbo');

      const result = await storage.showSaveDialog();

      expect(result).toBe('/save/location.arbo');
      expect(window.electron.showSaveDialog).toHaveBeenCalled();
    });

    it('should return null when dialog is cancelled', async () => {
      vi.mocked(window.electron.showSaveDialog).mockResolvedValue(null);

      const result = await storage.showSaveDialog();

      expect(result).toBeNull();
    });
  });

  describe('saveSession', () => {
    it('should save session state as JSON', async () => {
      const session: SessionState = {
        openFiles: ['/path/to/file.arbo'],
        activeFilePath: '/path/to/file.arbo',
      };

      vi.mocked(window.electron.saveSession).mockResolvedValue(undefined);

      await storage.saveSession(session);

      expect(window.electron.saveSession).toHaveBeenCalledWith(
        JSON.stringify(session, null, 2)
      );
    });

    it('should format session JSON with indentation', async () => {
      const session: SessionState = {
        openFiles: ['/path/to/file.arbo'],
        activeFilePath: '/path/to/file.arbo',
      };

      vi.mocked(window.electron.saveSession).mockResolvedValue(undefined);

      await storage.saveSession(session);

      const savedContent = vi.mocked(window.electron.saveSession).mock.calls[0][0];
      expect(savedContent).toContain('  ');
    });
  });

  describe('getSession', () => {
    it('should retrieve and parse session data', async () => {
      const session: SessionState = {
        openFiles: ['/path/to/file.arbo'],
        activeFilePath: '/path/to/file.arbo',
      };

      vi.mocked(window.electron.getSession).mockResolvedValue(JSON.stringify(session));

      const result = await storage.getSession();

      expect(result).toEqual(session);
    });

    it('should return null when no session data exists', async () => {
      vi.mocked(window.electron.getSession).mockResolvedValue(null);

      const result = await storage.getSession();

      expect(result).toBeNull();
    });

    it('should return null on parse error', async () => {
      vi.mocked(window.electron.getSession).mockResolvedValue('invalid json{');

      const result = await storage.getSession();

      expect(result).toBeNull();
    });

    it('should return null for empty string', async () => {
      vi.mocked(window.electron.getSession).mockResolvedValue('');

      const result = await storage.getSession();

      expect(result).toBeNull();
    });
  });

  describe('createTempFile', () => {
    it('should create temp file with untitled-1 for first file', async () => {
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(null);
      vi.mocked(window.electron.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');
      vi.mocked(window.electron.saveTempFilesMetadata).mockResolvedValue(undefined);

      const result = await storage.createTempFile(mockArboFile);

      expect(window.electron.createTempFile).toHaveBeenCalledWith(
        'untitled-1.arbo',
        yaml.dump(mockArboFile, { indent: 2, lineWidth: -1 })
      );
      expect(result).toBe('/tmp/untitled-1.arbo');
    });

    it('should increment untitled number for subsequent files', async () => {
      const existingFiles = ['/tmp/untitled-1.arbo', '/tmp/untitled-2.arbo'];
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify(existingFiles));

      // Mock createTempFile to return a path based on the filename that's passed to it
      vi.mocked(window.electron.createTempFile).mockImplementation(async (filename) => {
        return `/tmp/${filename}`;
      });
      vi.mocked(window.electron.saveTempFilesMetadata).mockResolvedValue(undefined);

      await storage.createTempFile(mockArboFile);

      expect(window.electron.createTempFile).toHaveBeenCalledWith(
        'untitled-3.arbo',
        yaml.dump(mockArboFile, { indent: 2, lineWidth: -1 })
      );
    });

    it('should update temp files metadata', async () => {
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(null);
      vi.mocked(window.electron.createTempFile).mockResolvedValue('/tmp/untitled-1.arbo');
      vi.mocked(window.electron.saveTempFilesMetadata).mockResolvedValue(undefined);

      await storage.createTempFile(mockArboFile);

      expect(window.electron.saveTempFilesMetadata).toHaveBeenCalledWith(
        JSON.stringify(['/tmp/untitled-1.arbo'])
      );
    });
  });

  describe('deleteTempFile', () => {
    it('should delete temp file and update metadata', async () => {
      const tempFiles = ['/tmp/untitled-1.arbo', '/tmp/untitled-2.arbo'];
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify(tempFiles));
      vi.mocked(window.electron.deleteTempFile).mockResolvedValue(undefined);
      vi.mocked(window.electron.saveTempFilesMetadata).mockResolvedValue(undefined);

      await storage.deleteTempFile('/tmp/untitled-1.arbo');

      expect(window.electron.deleteTempFile).toHaveBeenCalledWith('/tmp/untitled-1.arbo');
      expect(window.electron.saveTempFilesMetadata).toHaveBeenCalledWith(
        JSON.stringify(['/tmp/untitled-2.arbo'])
      );
    });

    it('should handle deleting last temp file', async () => {
      const tempFiles = ['/tmp/untitled-1.arbo'];
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify(tempFiles));
      vi.mocked(window.electron.deleteTempFile).mockResolvedValue(undefined);
      vi.mocked(window.electron.saveTempFilesMetadata).mockResolvedValue(undefined);

      await storage.deleteTempFile('/tmp/untitled-1.arbo');

      expect(window.electron.saveTempFilesMetadata).toHaveBeenCalledWith(JSON.stringify([]));
    });
  });

  describe('getTempFiles', () => {
    it('should retrieve temp files list', async () => {
      const tempFiles = ['/tmp/untitled-1.arbo', '/tmp/untitled-2.arbo'];
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify(tempFiles));

      const result = await storage.getTempFiles();

      expect(result).toEqual(tempFiles);
    });

    it('should return empty array when no metadata exists', async () => {
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(null);

      const result = await storage.getTempFiles();

      expect(result).toEqual([]);
    });

    it('should return empty array on parse error', async () => {
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue('invalid json{');

      const result = await storage.getTempFiles();

      expect(result).toEqual([]);
    });
  });

  describe('isTempFile', () => {
    it('should return true for temp file', async () => {
      const tempFiles = ['/tmp/untitled-1.arbo', '/tmp/untitled-2.arbo'];
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify(tempFiles));

      const result = await storage.isTempFile('/tmp/untitled-1.arbo');

      expect(result).toBe(true);
    });

    it('should return false for non-temp file', async () => {
      const tempFiles = ['/tmp/untitled-1.arbo'];
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(JSON.stringify(tempFiles));

      const result = await storage.isTempFile('/saved/file.arbo');

      expect(result).toBe(false);
    });

    it('should return false when no temp files exist', async () => {
      vi.mocked(window.electron.getTempFilesMetadata).mockResolvedValue(null);

      const result = await storage.isTempFile('/any/file.arbo');

      expect(result).toBe(false);
    });
  });

  describe('showUnsavedChangesDialog', () => {
    it('should show unsaved changes dialog and return response', async () => {
      vi.mocked(window.electron.showUnsavedChangesDialog).mockResolvedValue(0);

      const result = await storage.showUnsavedChangesDialog('test.arbo');

      expect(window.electron.showUnsavedChangesDialog).toHaveBeenCalledWith('test.arbo');
      expect(result).toBe(0);
    });

    it('should handle different response codes', async () => {
      vi.mocked(window.electron.showUnsavedChangesDialog).mockResolvedValue(1);

      const result = await storage.showUnsavedChangesDialog('test.arbo');

      expect(result).toBe(1);
    });
  });

  describe('saveReviewSession', () => {
    it('should save review session as JSON', async () => {
      vi.mocked(window.electron.saveReviewSession).mockResolvedValue(undefined);

      await storage.saveReviewSession({ activeReviews: { '/test/file.arbo': 'node1' } });

      expect(window.electron.saveReviewSession).toHaveBeenCalledWith(
        JSON.stringify({ activeReviews: { '/test/file.arbo': 'node1' } }, null, 2)
      );
    });
  });

  describe('getReviewSession', () => {
    it('should retrieve and parse review session', async () => {
      const sessionData = { activeReviews: { '/test/file.arbo': 'node1' } };
      vi.mocked(window.electron.getReviewSession).mockResolvedValue(JSON.stringify(sessionData));

      const result = await storage.getReviewSession();

      expect(result).toEqual(sessionData);
    });

    it('should return null when no session exists', async () => {
      vi.mocked(window.electron.getReviewSession).mockResolvedValue(null);

      const result = await storage.getReviewSession();

      expect(result).toBeNull();
    });

    it('should return null on parse error', async () => {
      vi.mocked(window.electron.getReviewSession).mockResolvedValue('invalid json{');

      const result = await storage.getReviewSession();

      expect(result).toBeNull();
    });
  });
});
