import { describe, it, expect } from 'vitest';
import { isReviewOverlap } from '../reviewOverlap';

// A review may not nest inside, or engulf, an existing review region. Overlap is a pure
// function of the candidate node, the set of nodes already in review, and the ancestor
// registry (node id -> ancestor ids, outermost first).
//
//   root → a → b → c
//   root → d
const ancestorRegistry: Record<string, string[]> = {
  root: [],
  a: ['root'],
  b: ['root', 'a'],
  c: ['root', 'a', 'b'],
  d: ['root'],
};

describe('isReviewOverlap', () => {
  it('is false when nothing is in review', () => {
    expect(isReviewOverlap('b', [], ancestorRegistry)).toBe(false);
  });

  it('is false for a node unrelated to the in-review set', () => {
    expect(isReviewOverlap('d', ['b'], ancestorRegistry)).toBe(false);
  });

  it('is false for a sibling of an in-review node', () => {
    expect(isReviewOverlap('a', ['d'], ancestorRegistry)).toBe(false);
  });

  it('is true when the node itself is already in review', () => {
    expect(isReviewOverlap('b', ['b'], ancestorRegistry)).toBe(true);
  });

  it('is true when an ancestor of the node is in review (no nesting)', () => {
    expect(isReviewOverlap('c', ['a'], ancestorRegistry)).toBe(true);
  });

  it('is true when a descendant of the node is in review (no engulfing)', () => {
    expect(isReviewOverlap('a', ['c'], ancestorRegistry)).toBe(true);
  });

  it('detects overlap against any member of a multi-review set', () => {
    expect(isReviewOverlap('c', ['d', 'a'], ancestorRegistry)).toBe(true);
    expect(isReviewOverlap('d', ['a', 'b'], ancestorRegistry)).toBe(false);
  });
});
