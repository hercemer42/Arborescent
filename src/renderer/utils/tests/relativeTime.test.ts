import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../relativeTime';

const NOW = 1_700_000_000_000;

describe('formatRelativeTime', () => {
  it('reports "just now" under a minute', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('just now');
  });

  it('reports minutes under an hour', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5m ago');
  });

  it('reports hours under a day', () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3h ago');
  });

  it('reports days beyond a day', () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe('2d ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(formatRelativeTime(NOW + 10_000, NOW)).toBe('just now');
  });
});
