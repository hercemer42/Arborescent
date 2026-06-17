import { describe, it, expect } from 'vitest';
import { DEFAULT_EXECUTE_CONTEXT } from '../sendActions';

describe('DEFAULT_EXECUTE_CONTEXT', () => {
  it('should be a non-empty string', () => {
    expect(typeof DEFAULT_EXECUTE_CONTEXT).toBe('string');
    expect(DEFAULT_EXECUTE_CONTEXT.length).toBeGreaterThan(0);
  });

  it('should contain execution-oriented instructions', () => {
    expect(DEFAULT_EXECUTE_CONTEXT).toMatch(/execut/i);
  });

  it('should not contain review-oriented instructions', () => {
    expect(DEFAULT_EXECUTE_CONTEXT).not.toMatch(/review/i);
    expect(DEFAULT_EXECUTE_CONTEXT).not.toMatch(/suggest improvements/i);
  });

  // Encountered issues should be recorded as a separate node per issue, not
  // collapsed into one. Copy is not pinned, so the positive match is tolerant.
  it('records encountered issues as a node per issue rather than a single child node', () => {
    expect(DEFAULT_EXECUTE_CONTEXT).not.toMatch(/record them as a child node/i);
    expect(DEFAULT_EXECUTE_CONTEXT).toMatch(
      /\bnodes\b|(?:separate|own|individual|distinct|new)\s+(?:child\s+)?node\b|\b(?:per|for each)\b[\s\S]{0,20}\bissue|\beach\s+issue\b/i,
    );
  });
});
