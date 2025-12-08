import { describe, it, expect } from 'vitest';
import { getTabProps } from '../useTabProps';
import { File } from '../../../../store/files/filesStore';

describe('getTabProps', () => {

  describe('fullName', () => {
    it('should return file path as fullName for saved files', () => {
      const file: File = {
        path: '/home/user/documents/project/file.arbo',
        displayName: 'file.arbo',
      };

      const result = getTabProps(file, undefined);

      expect(result.fullName).toBe('/home/user/documents/project/file.arbo');
    });

    it('should return undefined for temporary/untitled files', () => {
      const file: File = {
        path: '/tmp/untitled.arbo',
        displayName: 'Untitled',
        isTemporary: true,
      };

      const result = getTabProps(file, undefined);

      expect(result.fullName).toBeUndefined();
    });

    it('should return undefined for zoom tabs', () => {
      const file: File = {
        path: '/path/zoom-file.arbo',
        displayName: 'zoom-file.arbo',
        zoomSource: {
          sourceFilePath: '/path/source.arbo',
          zoomedNodeId: 'node-1',
        },
      };

      const result = getTabProps(file, undefined);

      expect(result.fullName).toBeUndefined();
    });
  });

  describe('isZoomTab', () => {
    it('should return true when file has zoomSource', () => {
      const file: File = {
        path: '/path/file.arbo',
        displayName: 'file.arbo',
        zoomSource: {
          sourceFilePath: '/path/source.arbo',
          zoomedNodeId: 'node-1',
        },
      };

      const result = getTabProps(file, undefined);

      expect(result.isZoomTab).toBe(true);
    });

    it('should return false when file has no zoomSource', () => {
      const file: File = {
        path: '/path/file.arbo',
        displayName: 'file.arbo',
      };

      const result = getTabProps(file, undefined);

      expect(result.isZoomTab).toBe(false);
    });
  });

  describe('isLastInGroup', () => {
    it('should return true for zoom tab with no next file', () => {
      const file: File = {
        path: '/path/zoom.arbo',
        displayName: 'zoom.arbo',
        zoomSource: {
          sourceFilePath: '/path/source.arbo',
          zoomedNodeId: 'node-1',
        },
      };

      const result = getTabProps(file, undefined);

      expect(result.isLastInGroup).toBe(true);
    });

    it('should return false for regular tab', () => {
      const file: File = {
        path: '/path/file.arbo',
        displayName: 'file.arbo',
      };

      const result = getTabProps(file, undefined);

      expect(result.isLastInGroup).toBe(false);
    });
  });

  describe('hasZoomToRight', () => {
    it('should return true when next file is a zoom of current file', () => {
      const file: File = {
        path: '/path/source.arbo',
        displayName: 'source.arbo',
      };
      const nextFile: File = {
        path: '/path/zoom.arbo',
        displayName: 'zoom.arbo',
        zoomSource: {
          sourceFilePath: '/path/source.arbo',
          zoomedNodeId: 'node-1',
        },
      };

      const result = getTabProps(file, nextFile);

      expect(result.hasZoomToRight).toBe(true);
    });

    it('should return false when next file is not a zoom of current file', () => {
      const file: File = {
        path: '/path/source.arbo',
        displayName: 'source.arbo',
      };
      const nextFile: File = {
        path: '/path/other.arbo',
        displayName: 'other.arbo',
      };

      const result = getTabProps(file, nextFile);

      expect(result.hasZoomToRight).toBe(false);
    });
  });
});
