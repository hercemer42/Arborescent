import { describe, it, expect } from 'vitest';
import { getUntitledNumber, getFilename, getDisplayName } from './fileNaming';

describe('fileNaming utils', () => {
  describe('getUntitledNumber', () => {
    it('should extract untitled number from path', () => {
      expect(getUntitledNumber('/tmp/untitled-1.arbo')).toBe('1');
      expect(getUntitledNumber('/tmp/untitled-42.arbo')).toBe('42');
      expect(getUntitledNumber('C:\\temp\\untitled-5.arbo')).toBe('5');
    });

    it('should return "1" as default when no number found', () => {
      expect(getUntitledNumber('/tmp/myfile.arbo')).toBe('1');
      expect(getUntitledNumber('')).toBe('1');
    });
  });

  describe('getFilename', () => {
    it('should extract filename from Unix path', () => {
      expect(getFilename('/home/user/myfile.arbo')).toBe('myfile.arbo');
      expect(getFilename('/tmp/test.txt')).toBe('test.txt');
    });

    it('should extract filename from Windows path', () => {
      expect(getFilename('C:\\Users\\user\\myfile.arbo')).toBe('myfile.arbo');
      expect(getFilename('C:\\temp\\test.txt')).toBe('test.txt');
    });

    it('should handle mixed separators', () => {
      expect(getFilename('C:/Users/user\\myfile.arbo')).toBe('myfile.arbo');
    });

    it('should return path itself if no separators', () => {
      expect(getFilename('myfile.arbo')).toBe('myfile.arbo');
    });

    it('should return path itself if empty', () => {
      expect(getFilename('')).toBe('');
    });
  });

  describe('getDisplayName', () => {
    it('should return "Untitled N" for temporary files', () => {
      expect(getDisplayName('/tmp/untitled-1.arbo', true)).toBe('Untitled 1');
      expect(getDisplayName('/tmp/untitled-42.arbo', true)).toBe('Untitled 42');
    });

    it('should return filename for non-temporary files', () => {
      expect(getDisplayName('/home/user/myfile.arbo', false)).toBe('myfile.arbo');
      expect(getDisplayName('C:\\Users\\user\\test.txt', false)).toBe('test.txt');
    });
  });
});
