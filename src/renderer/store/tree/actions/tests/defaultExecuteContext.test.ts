import { describe, it, expect } from 'vitest';
import { DEFAULT_EXECUTE_CONTEXT } from '../sendActions';

// DEFAULT_REVIEW_CONTEXT is not exported, so we test DEFAULT_EXECUTE_CONTEXT independently
// and verify it doesn't contain review-oriented instructions

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
});
