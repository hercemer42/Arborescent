import { describe, it, expect } from 'vitest';
import {
  getInReviewNodeIds,
  isNodeInReview,
  isReviewDescendant,
  reviewsInSubtree,
  isReviewOverlap,
  overlapsOtherReview,
  getBrowserReviewNodeId,
  hasBrowserReview,
  addReview,
  removeReview,
  type ReviewEntry,
  type ReviewMap,
} from '../reviews';
import type { AncestorRegistry } from '../../../utils/ancestry';

// root → a → b → c
// root → d
const ancestorRegistry: AncestorRegistry = {
  root: [],
  a: ['root'],
  b: ['root', 'a'],
  c: ['root', 'a', 'b'],
  d: ['root'],
};

function terminalEntry(terminalId = 'term-1'): ReviewEntry {
  return { source: 'terminal', terminalId };
}

function browserEntry(): ReviewEntry {
  return { source: 'browser', terminalId: null };
}

describe('getInReviewNodeIds', () => {
  it('returns the keys of the review map', () => {
    const reviews: ReviewMap = { a: terminalEntry(), b: browserEntry() };
    expect(getInReviewNodeIds(reviews).sort()).toEqual(['a', 'b']);
  });

  it('returns an empty array for an undefined map', () => {
    expect(getInReviewNodeIds(undefined)).toEqual([]);
  });
});

describe('isNodeInReview', () => {
  it('is true when the node is present', () => {
    expect(isNodeInReview({ a: terminalEntry() }, 'a')).toBe(true);
  });

  it('is false when the node is absent', () => {
    expect(isNodeInReview({ a: terminalEntry() }, 'b')).toBe(false);
  });

  it('is false for an undefined map', () => {
    expect(isNodeInReview(undefined, 'a')).toBe(false);
  });
});

describe('isReviewDescendant', () => {
  it('is true when an ancestor is in review', () => {
    expect(isReviewDescendant({ a: terminalEntry() }, 'c', ancestorRegistry)).toBe(true);
  });

  it('is false when no ancestor is in review', () => {
    expect(isReviewDescendant({ d: terminalEntry() }, 'c', ancestorRegistry)).toBe(false);
  });

  it('is false for an undefined map', () => {
    expect(isReviewDescendant(undefined, 'c', ancestorRegistry)).toBe(false);
  });
});

describe('reviewsInSubtree', () => {
  it('includes the node itself when it is in review', () => {
    expect(reviewsInSubtree({ a: terminalEntry() }, 'a', ancestorRegistry)).toEqual(['a']);
  });

  it('includes any in-review descendant via the ancestor registry', () => {
    expect(reviewsInSubtree({ c: terminalEntry() }, 'a', ancestorRegistry)).toEqual(['c']);
  });

  it('returns both the node itself and its in-review descendants', () => {
    const reviews: ReviewMap = { a: terminalEntry(), c: browserEntry() };
    expect(reviewsInSubtree(reviews, 'a', ancestorRegistry).sort()).toEqual(['a', 'c']);
  });

  it('excludes reviews outside the subtree', () => {
    const reviews: ReviewMap = { c: terminalEntry(), d: terminalEntry() };
    expect(reviewsInSubtree(reviews, 'a', ancestorRegistry)).toEqual(['c']);
  });

  it('returns an empty array for an undefined map', () => {
    expect(reviewsInSubtree(undefined, 'a', ancestorRegistry)).toEqual([]);
  });
});

describe('getBrowserReviewNodeId', () => {
  it('returns null when there is no browser entry', () => {
    expect(getBrowserReviewNodeId({ a: terminalEntry() })).toBeNull();
  });

  it('returns the id of the single browser entry', () => {
    expect(getBrowserReviewNodeId({ a: terminalEntry(), b: browserEntry() })).toBe('b');
  });

  it('returns the first browser entry when there are two', () => {
    const reviews: ReviewMap = { b: browserEntry(), c: browserEntry() };
    expect(getBrowserReviewNodeId(reviews)).toBe('b');
  });

  it('returns null for an undefined map', () => {
    expect(getBrowserReviewNodeId(undefined)).toBeNull();
  });
});

describe('hasBrowserReview', () => {
  it('is true when a browser review exists', () => {
    expect(hasBrowserReview({ a: terminalEntry(), b: browserEntry() })).toBe(true);
  });

  it('is false when only terminal reviews exist', () => {
    expect(hasBrowserReview({ a: terminalEntry() })).toBe(false);
  });

  it('is false for an undefined map', () => {
    expect(hasBrowserReview(undefined)).toBe(false);
  });
});

describe('addReview', () => {
  it('adds a new entry without mutating the base map', () => {
    const base: ReviewMap = { a: terminalEntry() };
    const entry = browserEntry();
    const next = addReview(base, 'b', entry);

    expect(next).toEqual({ a: base.a, b: entry });
    expect(base).toEqual({ a: base.a });
  });

  it('overwrites an existing key', () => {
    const base: ReviewMap = { a: terminalEntry('term-1') };
    const entry = terminalEntry('term-2');
    const next = addReview(base, 'a', entry);

    expect(next.a).toBe(entry);
  });

  it('tolerates an undefined base map', () => {
    const entry = terminalEntry();
    expect(addReview(undefined, 'a', entry)).toEqual({ a: entry });
  });
});

describe('removeReview', () => {
  it('removes a present key without mutating the base map', () => {
    const base: ReviewMap = { a: terminalEntry(), b: browserEntry() };
    const next = removeReview(base, 'a');

    expect(next).toEqual({ b: base.b });
    expect(base).toEqual({ a: base.a, b: base.b });
  });

  it('returns the same map reference when the key is absent', () => {
    const base: ReviewMap = { a: terminalEntry() };
    expect(removeReview(base, 'b')).toBe(base);
  });

  it('tolerates an undefined map', () => {
    expect(removeReview(undefined, 'a')).toEqual({});
  });
});

// A review may not nest inside, or engulf, an existing one: overlap is true when the candidate
// node, an ancestor, or a descendant is already in review.
describe('isReviewOverlap', () => {
  it('is false when nothing is in review', () => {
    expect(isReviewOverlap({}, 'b', ancestorRegistry)).toBe(false);
  });

  it('is false for a node unrelated to the in-review set', () => {
    expect(isReviewOverlap({ b: terminalEntry() }, 'd', ancestorRegistry)).toBe(false);
  });

  it('is false for a sibling of an in-review node', () => {
    expect(isReviewOverlap({ d: terminalEntry() }, 'a', ancestorRegistry)).toBe(false);
  });

  it('is true when the node itself is already in review', () => {
    expect(isReviewOverlap({ b: terminalEntry() }, 'b', ancestorRegistry)).toBe(true);
  });

  it('is true when an ancestor of the node is in review (no nesting)', () => {
    expect(isReviewOverlap({ a: terminalEntry() }, 'c', ancestorRegistry)).toBe(true);
  });

  it('is true when a descendant of the node is in review (no engulfing)', () => {
    expect(isReviewOverlap({ c: terminalEntry() }, 'a', ancestorRegistry)).toBe(true);
  });

  it('detects overlap against any member of a multi-review set', () => {
    expect(isReviewOverlap({ d: terminalEntry(), a: terminalEntry() }, 'c', ancestorRegistry)).toBe(true);
    expect(isReviewOverlap({ a: terminalEntry(), b: terminalEntry() }, 'd', ancestorRegistry)).toBe(false);
  });

  it('is false for an undefined map', () => {
    expect(isReviewOverlap(undefined, 'b', ancestorRegistry)).toBe(false);
  });
});

describe('overlapsOtherReview', () => {
  it('is false when nothing is in review', () => {
    expect(overlapsOtherReview({}, 'b', ancestorRegistry)).toBe(false);
  });

  it('is false for a node unrelated to the in-review set', () => {
    expect(overlapsOtherReview({ b: terminalEntry() }, 'd', ancestorRegistry)).toBe(false);
  });

  it('is false when only the node itself is in review (a submit delivers to its own review, not a second one)', () => {
    expect(overlapsOtherReview({ b: terminalEntry() }, 'b', ancestorRegistry)).toBe(false);
  });

  it('is true when an ancestor of the node is in review (no nesting)', () => {
    expect(overlapsOtherReview({ a: terminalEntry() }, 'c', ancestorRegistry)).toBe(true);
  });

  it('is true when a strict descendant of the node is in review (no engulfing)', () => {
    expect(overlapsOtherReview({ c: terminalEntry() }, 'a', ancestorRegistry)).toBe(true);
  });

  it('still detects a descendant overlap when the node itself is also in review (self excluded, descendant counts)', () => {
    expect(overlapsOtherReview({ a: terminalEntry(), c: terminalEntry() }, 'a', ancestorRegistry)).toBe(true);
  });

  it('is false for an undefined map', () => {
    expect(overlapsOtherReview(undefined, 'b', ancestorRegistry)).toBe(false);
  });
});
