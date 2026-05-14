import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMarkdown } from '../markdown';
import { logger } from '../../services/logger';

vi.mock('../../services/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('parseMarkdown warns when it drops non-heading content', () => {
  const warnSpy = vi.mocked(logger.warn);

  beforeEach(() => {
    warnSpy.mockClear();
  });

  describe('happy path — non-heading lines surface as warnings', () => {
    it('warns once for a single dropped paragraph line', () => {
      const markdown = '# [ ] Parent\nthis is a paragraph line that should not be silently dropped';
      parseMarkdown(markdown);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('names the dropped content in the warning so the user can see what was lost', () => {
      const droppedLine = 'https://example.com/some-resource';
      const markdown = `# [ ] Parent\n${droppedLine}`;
      parseMarkdown(markdown);

      const warnCalls = warnSpy.mock.calls;
      const allArgs = warnCalls.flat().map(String).join(' ');
      expect(allArgs).toContain(droppedLine);
    });

    it('warns separately for each dropped paragraph line in a multi-line block', () => {
      const markdown = '# [ ] Parent\nfirst dropped line\nsecond dropped line\nthird dropped line';
      parseMarkdown(markdown);

      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('still returns the parsed heading nodes (warning is non-blocking)', () => {
      const markdown = '# [ ] Parent\nthis line is dropped\n## [ ] Child';
      const { rootNodes, allNodes } = parseMarkdown(markdown);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].content).toBe('Parent');
      const childId = rootNodes[0].children[0];
      expect(allNodes[childId].content).toBe('Child');
    });
  });

  describe('regression — heading-only input does not warn', () => {
    it('does not warn for a single heading', () => {
      parseMarkdown('# [ ] Just a heading');

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for a nested heading hierarchy', () => {
      parseMarkdown('# [ ] Parent\n## [ ] Child\n### [ ] Grandchild');

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for heading lines surrounded by blank lines', () => {
      parseMarkdown('\n\n# [ ] Parent\n\n## [ ] Child\n\n');

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('edge cases — empty, whitespace, and code fences', () => {
    it('does not warn on empty input', () => {
      parseMarkdown('');

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn on whitespace-only input', () => {
      parseMarkdown('   \n  \n   ');

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for outer code-fence markers that the parser already strips', () => {
      parseMarkdown('```markdown\n# [ ] Task\n```');

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for plain text input — when no heading anchored the parse there is no data loss to report (the input is just not markdown, e.g. a prose clipboard paste)', () => {
      parseMarkdown('first plain line\nsecond plain line\nthird plain line');

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('regression — values captured as headings survive a parse round-trip into step 2 CONTENT', () => {
    it('a step-1 markdown response with a text value captured as its own heading is preserved through parseMarkdown', () => {
      const stepOneOutput = '# [ ] Parent\n## [ ] Recorded value: my important text';
      const { rootNodes, allNodes } = parseMarkdown(stepOneOutput);

      expect(rootNodes).toHaveLength(1);
      const childId = rootNodes[0].children[0];
      expect(allNodes[childId].content).toBe('Recorded value: my important text');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('the same value written as a paragraph line under the parent does NOT survive parsing (this is the bug being closed)', () => {
      const stepOneOutput = '# [ ] Parent\nRecorded value: my important text';
      const { rootNodes, allNodes } = parseMarkdown(stepOneOutput);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].children).toHaveLength(0);
      const allContents = Object.values(allNodes).map((n) => n.content);
      expect(allContents).not.toContain('Recorded value: my important text');
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
