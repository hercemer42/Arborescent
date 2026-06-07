import { describe, it, expect } from 'vitest';
import { basename } from '../basename';

describe('basename', () => {
  it('returns the final segment of a slash-separated path', () => {
    expect(basename('/projects/notes/file-a.arbo')).toBe('file-a.arbo');
  });

  it('returns the whole string when there is no separator', () => {
    expect(basename('file-a.arbo')).toBe('file-a.arbo');
  });

  it('falls back to the input for an empty string', () => {
    expect(basename('')).toBe('');
  });
});
