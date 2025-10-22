import { describe, it, expect } from 'vitest';
import { getNextUntitledNumber } from './fileNaming';

describe('getNextUntitledNumber', () => {
  it('should return 1 when given an empty array', () => {
    expect(getNextUntitledNumber([])).toBe(1);
  });

  it('should return 2 when only untitled-1.json exists', () => {
    const paths = ['/path/to/untitled-1.json'];
    expect(getNextUntitledNumber(paths)).toBe(2);
  });

  it('should return max + 1 when multiple untitled files exist', () => {
    const paths = [
      '/path/to/untitled-1.json',
      '/path/to/untitled-3.json',
      '/path/to/untitled-2.json',
    ];
    expect(getNextUntitledNumber(paths)).toBe(4);
  });

  it('should ignore files that do not match the untitled pattern', () => {
    const paths = [
      '/path/to/untitled-1.json',
      '/path/to/myfile.json',
      '/path/to/document.arbo',
      '/path/to/untitled-3.json',
    ];
    expect(getNextUntitledNumber(paths)).toBe(4);
  });

  it('should handle non-sequential numbers', () => {
    const paths = [
      '/path/to/untitled-1.json',
      '/path/to/untitled-5.json',
      '/path/to/untitled-10.json',
    ];
    expect(getNextUntitledNumber(paths)).toBe(11);
  });

  it('should work with different path formats', () => {
    const paths = [
      'C:\\Users\\test\\untitled-1.json',
      '/home/user/untitled-2.json',
      'untitled-3.json',
    ];
    expect(getNextUntitledNumber(paths)).toBe(4);
  });

  it('should return 1 when files match pattern but have no valid numbers', () => {
    const paths = [
      '/path/to/untitled-.json',
      '/path/to/untitled-abc.json',
    ];
    expect(getNextUntitledNumber(paths)).toBe(1);
  });
});
