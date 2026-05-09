import { describe, it, expect } from 'vitest';
import { extractWrappedCommand, isCodeCommandNode } from '../codeNode';
import { TreeNode } from '@shared/types';
import { AncestorRegistry } from '../ancestry';

const createNode = (id: string, content: string, overrides: Partial<TreeNode> = {}): TreeNode => ({
  id,
  content,
  children: [],
  metadata: { plugins: {} },
  ...overrides,
});

const buildSingletonState = (
  node: TreeNode,
): { nodes: Record<string, TreeNode>; ancestorRegistry: AncestorRegistry } => ({
  nodes: { [node.id]: node },
  ancestorRegistry: { [node.id]: [] },
});

describe('extractWrappedCommand', () => {
  describe('happy path — single backtick wrapping', () => {
    it('strips wrapping single backticks from a one-line command', () => {
      expect(extractWrappedCommand('`npm install`')).toBe('npm install');
    });

    it('preserves internal whitespace', () => {
      expect(extractWrappedCommand('`git log --oneline -5`')).toBe('git log --oneline -5');
    });

    it('preserves internal punctuation and operators', () => {
      expect(extractWrappedCommand('`echo $HOME && pwd`')).toBe('echo $HOME && pwd');
    });
  });

  describe('happy path — triple backtick (fenced) wrapping', () => {
    it('strips wrapping triple backticks from a fenced single-line command', () => {
      expect(extractWrappedCommand('```npm install```')).toBe('npm install');
    });

    it('strips fenced multi-line content and preserves embedded newlines', () => {
      const input = '```\nnpm install\nnpm test\n```';
      expect(extractWrappedCommand(input)).toBe('npm install\nnpm test');
    });

    it('strips a fenced block with a language hint after the opening fence', () => {
      const input = '```bash\nls -la\n```';
      expect(extractWrappedCommand(input)).toBe('ls -la');
    });
  });

  describe('rejection — content not wholly wrapped', () => {
    it('returns null when content has prose before a backticked span', () => {
      expect(extractWrappedCommand('Run `npm install` first')).toBeNull();
    });

    it('returns null when content has prose after a backticked span', () => {
      expect(extractWrappedCommand('`npm install` then proceed')).toBeNull();
    });

    it('returns null when content contains a backticked span among other text', () => {
      expect(extractWrappedCommand('First do `step one`, then `step two`')).toBeNull();
    });

    it('returns null when content has no backticks at all', () => {
      expect(extractWrappedCommand('npm install')).toBeNull();
    });

    it('returns null when only one backtick appears (unterminated)', () => {
      expect(extractWrappedCommand('`npm install')).toBeNull();
    });

    it('returns null when content is bullet-list markdown that happens to contain a backticked span', () => {
      expect(extractWrappedCommand('- `npm install`')).toBeNull();
    });
  });

  describe('boundary values', () => {
    it('returns null for the empty string', () => {
      expect(extractWrappedCommand('')).toBeNull();
    });

    it('returns null for a whitespace-only string', () => {
      expect(extractWrappedCommand('   \n  \t  ')).toBeNull();
    });

    it('returns null for a backtick-wrapped empty span', () => {
      expect(extractWrappedCommand('``')).toBeNull();
    });

    it('returns null for a backtick-wrapped whitespace-only span', () => {
      expect(extractWrappedCommand('`   `')).toBeNull();
    });
  });
});

describe('isCodeCommandNode', () => {
  describe('happy path — code-node candidate', () => {
    it('returns true when the entire content is wrapped in single backticks, with no children and no context', () => {
      const node = createNode('n1', '`npm install`');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(true);
    });

    it('returns true for a fenced triple-backtick wrapper', () => {
      const node = createNode('n1', '```bash\nls -la\n```');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(true);
    });
  });

  describe('rejection — content rule (rule 1)', () => {
    it('returns false when content mixes a backticked span with surrounding prose', () => {
      const node = createNode('n1', 'Run `npm install` then test');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });

    it('returns false when content has no backticks', () => {
      const node = createNode('n1', 'npm install');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });
  });

  describe('rejection — hierarchy rule (rule 2: has children)', () => {
    it('returns false when a backtick-wrapped node has children, even if the children are also backticked', () => {
      const parent = createNode('p1', '`npm install`', { children: ['c1'] });
      const child = createNode('c1', '`npm test`');
      const nodes = { p1: parent, c1: child };
      const ancestorRegistry: AncestorRegistry = { p1: [], c1: ['p1'] };
      expect(isCodeCommandNode('p1', nodes, ancestorRegistry)).toBe(false);
    });
  });

  describe('rejection — context rule (rule 2: has context applied)', () => {
    it('returns false when a backtick-wrapped node has appliedContextId set on itself', () => {
      const ctx = createNode('ctx1', 'Some context', {
        metadata: { isContextDeclaration: true, plugins: {} },
      });
      const node = createNode('n1', '`npm install`', {
        metadata: { plugins: {}, appliedContextId: 'ctx1' },
      });
      const nodes = { n1: node, ctx1: ctx };
      const ancestorRegistry: AncestorRegistry = { n1: [], ctx1: [] };
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });

    it('returns false when a backtick-wrapped node inherits a context from an ancestor', () => {
      const ctx = createNode('ctx1', 'Some context', {
        metadata: { isContextDeclaration: true, plugins: {} },
      });
      const ancestor = createNode('a1', 'Ancestor', {
        children: ['n1'],
        metadata: { plugins: {}, appliedContextId: 'ctx1' },
      });
      const node = createNode('n1', '`npm install`');
      const nodes = { a1: ancestor, n1: node, ctx1: ctx };
      const ancestorRegistry: AncestorRegistry = { a1: [], n1: ['a1'], ctx1: [] };
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });

    it('returns false when the synthetic basic-execute context is applied', () => {
      const node = createNode('n1', '`npm install`', {
        metadata: { plugins: {}, appliedContextId: '__basic_execute__' },
      });
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });
  });

  describe('boundary and empty inputs', () => {
    it('returns false for an empty-content node', () => {
      const node = createNode('n1', '');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });

    it('returns false for a whitespace-only node', () => {
      const node = createNode('n1', '   \n   ');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });

    it('returns false for a node whose entire content is just empty backticks', () => {
      const node = createNode('n1', '``');
      const { nodes, ancestorRegistry } = buildSingletonState(node);
      expect(isCodeCommandNode('n1', nodes, ancestorRegistry)).toBe(false);
    });

    it('returns false when the nodeId does not exist in the nodes map', () => {
      expect(isCodeCommandNode('missing', {}, {})).toBe(false);
    });
  });
});
