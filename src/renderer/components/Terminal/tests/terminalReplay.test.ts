import { describe, it, expect } from 'vitest';
import { clipChunkAfterWatermark } from '../terminalReplay';

describe('clipChunkAfterWatermark', () => {
  it('returns the whole chunk when it starts at or after the watermark', () => {
    expect(clipChunkAfterWatermark('def', 6, 3)).toBe('def');
  });

  it('drops a chunk entirely contained within the replayed range', () => {
    expect(clipChunkAfterWatermark('abc', 3, 5)).toBe('');
  });

  it('drops a chunk that ends exactly at the watermark', () => {
    expect(clipChunkAfterWatermark('abc', 3, 3)).toBe('');
  });

  it('writes only the portion after the watermark for a straddling chunk', () => {
    expect(clipChunkAfterWatermark('abcdef', 6, 3)).toBe('def');
  });

  it('returns the chunk verbatim when no offset is available to dedupe by', () => {
    expect(clipChunkAfterWatermark('xyz', undefined, 100)).toBe('xyz');
  });

  it('treats an empty chunk as nothing to write', () => {
    expect(clipChunkAfterWatermark('', 5, 3)).toBe('');
  });
});
