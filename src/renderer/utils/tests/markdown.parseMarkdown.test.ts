import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../markdown';

describe('parseMarkdown', () => {
  it('parses a single node', () => {
    const markdown = '# ☐ Test task';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
    expect(rootNodes[0].metadata.status).toBe('pending');
  });

  it('parses nested nodes with heading levels', () => {
    const markdown = '# ☐ Parent task\n## ✓ Subtask';
    const { rootNodes, allNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Parent task');
    expect(rootNodes[0].children).toHaveLength(1);

    const childId = rootNodes[0].children[0];
    expect(allNodes[childId].content).toBe('Subtask');
    expect(allNodes[childId].metadata.status).toBe('completed');
  });

  it('parses deeply nested hierarchy', () => {
    const markdown = '# ☐ Parent\n## ☐ Child\n### ☐ Grandchild';
    const { rootNodes, allNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);

    const parent = rootNodes[0];
    const childId = parent.children[0];
    const child = allNodes[childId];
    const grandchildId = child.children[0];
    const grandchild = allNodes[grandchildId];

    expect(parent.content).toBe('Parent');
    expect(child.content).toBe('Child');
    expect(grandchild.content).toBe('Grandchild');
  });

  it('parses different status symbols', () => {
    const markdown = '# ☐ Pending\n## ✓ Completed\n## ✗ Failed';
    const { rootNodes, allNodes } = parseMarkdown(markdown);

    const parent = rootNodes[0];

    expect(parent.metadata.status).toBe('pending');

    const child1Id = parent.children[0];
    const child2Id = parent.children[1];
    expect(allNodes[child1Id].metadata.status).toBe('completed');
    expect(allNodes[child2Id].metadata.status).toBe('abandoned');
  });

  it('handles multiple siblings at same level', () => {
    const markdown = '# ☐ Parent\n## ☐ First\n## ☐ Second\n## ☐ Third';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes[0].children).toHaveLength(3);
  });

  it('strips markdown code block markers', () => {
    const markdown = '```markdown\n# ☐ Test task\n```';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
  });

  it('strips generic code block markers', () => {
    const markdown = '```\n# ☐ Test task\n```';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
  });

  it('strips code block with nested content', () => {
    const markdown = '```markdown\n# ☐ Parent\n## ✓ Child\n### ☐ Grandchild\n```';
    const { rootNodes, allNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);

    const parent = rootNodes[0];
    const childId = parent.children[0];
    const child = allNodes[childId];

    expect(parent.content).toBe('Parent');
    expect(child.content).toBe('Child');
    expect(child.children).toHaveLength(1);
  });

  it('handles content without code block markers', () => {
    const markdown = '# ☐ Test task\n## ✓ Subtask';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
  });

  it('handles headings without status symbols', () => {
    const markdown = '# Task without symbol';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Task without symbol');
    expect(rootNodes[0].metadata.status).toBe('pending'); // defaults to pending
  });

  it('skips empty heading lines', () => {
    const markdown = '# ☐ Task\n##\n## ☐ Another';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].children).toHaveLength(1);
  });

  it('handles whitespace around content', () => {
    const markdown = '  # ☐ Test task  \n  ## ✓ Subtask  ';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
  });

  it('parses ASCII checkbox [ ] as pending', () => {
    const markdown = '# [ ] Test task';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
    expect(rootNodes[0].metadata.status).toBe('pending');
  });

  it('parses ASCII checkbox [x] as completed', () => {
    const markdown = '# [x] Test task';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
    expect(rootNodes[0].metadata.status).toBe('completed');
  });

  it('parses ASCII checkbox [X] as completed', () => {
    const markdown = '# [X] Test task';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Test task');
    expect(rootNodes[0].metadata.status).toBe('completed');
  });

  it('parses mixed ASCII and Unicode checkboxes', () => {
    const markdown = '# [ ] Parent\n## [x] Child completed\n## ☐ Child pending\n## ✓ Child done';
    const { rootNodes, allNodes } = parseMarkdown(markdown);

    const parent = rootNodes[0];
    expect(parent.metadata.status).toBe('pending');
    expect(parent.children).toHaveLength(3);

    const child1 = allNodes[parent.children[0]];
    const child2 = allNodes[parent.children[1]];
    const child3 = allNodes[parent.children[2]];

    expect(child1.metadata.status).toBe('completed');
    expect(child2.metadata.status).toBe('pending');
    expect(child3.metadata.status).toBe('completed');
  });

  it('parses ASCII checkbox [-] as failed', () => {
    const markdown = '# [-] Failed task';
    const { rootNodes } = parseMarkdown(markdown);

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].content).toBe('Failed task');
    expect(rootNodes[0].metadata.status).toBe('abandoned');
  });

  describe('HTML comments are ignored', () => {
    it('includes HTML comments in content (no special handling)', () => {
      // HTML comments are now treated as regular content, not parsed for context
      const markdown = '# [ ] Task with comment <!-- some:comment -->';
      const { rootNodes } = parseMarkdown(markdown);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].content).toBe('Task with comment <!-- some:comment -->');
      expect(rootNodes[0].metadata.appliedContextIds).toBeUndefined();
    });
  });

  describe('plain text without markdown headings', () => {
    it('returns empty result for plain text without headings', () => {
      const plainText = 'hello world';
      const { rootNodes, allNodes } = parseMarkdown(plainText);

      expect(rootNodes).toHaveLength(0);
      expect(Object.keys(allNodes)).toHaveLength(0);
    });

    it('returns empty result for multi-line plain text', () => {
      const plainText = 'first line\nsecond line\nthird line';
      const { rootNodes, allNodes } = parseMarkdown(plainText);

      expect(rootNodes).toHaveLength(0);
      expect(Object.keys(allNodes)).toHaveLength(0);
    });

    it('returns empty result for empty string', () => {
      const { rootNodes, allNodes } = parseMarkdown('');

      expect(rootNodes).toHaveLength(0);
      expect(Object.keys(allNodes)).toHaveLength(0);
    });

    it('returns empty result for whitespace only', () => {
      const { rootNodes, allNodes } = parseMarkdown('   \n  \n   ');

      expect(rootNodes).toHaveLength(0);
      expect(Object.keys(allNodes)).toHaveLength(0);
    });
  });
});
