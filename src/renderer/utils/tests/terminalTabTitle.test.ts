import { describe, it, expect } from 'vitest';
import { extractTaskTitle } from '../terminalTabTitle';
import type { TreeNode } from '../../../shared/types';

function makeNode(content: string): TreeNode {
  return { id: 'n', content, children: [], metadata: {} } as unknown as TreeNode;
}

describe('extractTaskTitle', () => {
  it('returns single-line content trimmed', () => {
    expect(extractTaskTitle(makeNode('  Replace terminal tab name  '))).toBe(
      'Replace terminal tab name',
    );
  });

  it('returns the first non-empty line when content is multi-line', () => {
    expect(extractTaskTitle(makeNode('First line\nSecond line\nThird line'))).toBe(
      'First line',
    );
  });

  it('skips leading blank lines and returns the first non-empty line', () => {
    expect(extractTaskTitle(makeNode('\n\n  Real title  \nbody'))).toBe('Real title');
  });

  it('returns an empty string when content is empty', () => {
    expect(extractTaskTitle(makeNode(''))).toBe('');
  });

  it('returns an empty string when content is whitespace only', () => {
    expect(extractTaskTitle(makeNode('   \n  \t  \n'))).toBe('');
  });

  it('preserves unicode and emoji characters', () => {
    expect(extractTaskTitle(makeNode('🛠️ Refactor — résumé'))).toBe(
      '🛠️ Refactor — résumé',
    );
  });

  it('returns long content unchanged so the terminal can handle truncation natively', () => {
    const long = 'a'.repeat(500);
    expect(extractTaskTitle(makeNode(long))).toBe(long);
  });

  it('strips ASCII C0 control characters and DEL from the title', () => {
    const noisy = 'hello\x07wo\x1Brld\x7Ffoo';
    expect(extractTaskTitle(makeNode(noisy))).toBe('helloworldfoo');
  });
});
