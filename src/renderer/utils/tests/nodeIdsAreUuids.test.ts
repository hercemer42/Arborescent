import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseMarkdown } from '../markdown';
import { cloneNodesWithNewIds } from '../nodeCloning';
import type { TreeNode } from '@shared/types';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Tree node ids must be UUIDs, never derived from content. Content-derived
// ids would make cross-file references fragile (rename breaks lookups) and
// would produce noisy YAML diffs whenever a title changes.

describe('node-id invariant — ids are UUIDs, never derived from content', () => {
  describe('parseMarkdown', () => {
    it('generates UUID-v4 ids for every parsed node, regardless of heading text', () => {
      const markdown = [
        '# File management',
        '## Open file',
        '## Save file',
        '# Workflow execution',
      ].join('\n');

      const { allNodes } = parseMarkdown(markdown);

      const ids = Object.keys(allNodes);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(id).toMatch(UUID_V4_PATTERN);
      }
    });

    it('does not derive ids from heading content (no slug-based ids)', () => {
      const markdown = '# File management\n## Open file';

      const { allNodes } = parseMarkdown(markdown);

      const ids = Object.keys(allNodes);
      expect(ids).not.toContain('file-management');
      expect(ids).not.toContain('open-file');
      expect(ids).not.toContain('File management');
    });

    it('generates unique ids even for identical heading content', () => {
      const markdown = '# Same title\n# Same title';

      const { allNodes } = parseMarkdown(markdown);

      const ids = Object.keys(allNodes);
      expect(ids.length).toBe(2);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe('cloneNodesWithNewIds', () => {
    it('generates UUID-v4 ids for every cloned node', () => {
      const sourceNodes: Record<string, TreeNode> = {
        'original-root': { id: 'original-root', content: 'Root', children: ['child-a'], metadata: {} },
        'child-a': { id: 'child-a', content: 'Child A', children: [], metadata: {} },
      };

      const { newNodesMap } = cloneNodesWithNewIds(['original-root'], sourceNodes);

      const clonedIds = Object.keys(newNodesMap);
      expect(clonedIds.length).toBe(2);
      for (const id of clonedIds) {
        expect(id).toMatch(UUID_V4_PATTERN);
      }
    });

    it('does not reuse source ids (fresh UUIDs, not content-derived)', () => {
      const sourceNodes: Record<string, TreeNode> = {
        src: { id: 'src', content: 'hello', children: [], metadata: {} },
      };

      const { newNodesMap } = cloneNodesWithNewIds(['src'], sourceNodes);

      expect(Object.keys(newNodesMap)).not.toContain('src');
      expect(Object.keys(newNodesMap)).not.toContain('hello');
    });
  });

  describe('shipped .arbo seed files contain only UUID node keys (plus the root sentinel)', () => {
    const ROOT_SENTINEL = 'root';
    const repoRoot = process.cwd();

    function extractNodeKeys(yaml: string): string[] {
      // Node entries are indented two spaces under the top-level `nodes:` key.
      // They appear as `  <id>:` followed by more deeply indented fields.
      const keys: string[] = [];
      const lines = yaml.split('\n');
      let inNodes = false;
      for (const line of lines) {
        if (/^nodes:\s*$/.test(line)) {
          inNodes = true;
          continue;
        }
        if (inNodes && /^[^\s]/.test(line)) {
          // Dedented out of nodes block
          break;
        }
        if (inNodes) {
          const match = /^ {2}([^\s][^:]*):\s*$/.exec(line);
          if (match) keys.push(match[1]);
        }
      }
      return keys;
    }

    it('project.arbo uses only UUID ids (plus root)', () => {
      const content = readFileSync(join(repoRoot, 'project.arbo'), 'utf8');
      const keys = extractNodeKeys(content);

      const nonUuid = keys.filter(k => k !== ROOT_SENTINEL && !UUID_V4_PATTERN.test(k));
      expect(nonUuid).toEqual([]);
    });

    it('all blueprints/*.arbo files use only UUID ids (plus root)', () => {
      const blueprintsDir = join(repoRoot, 'blueprints');
      const files = readdirSync(blueprintsDir).filter(f => f.endsWith('.arbo'));
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const content = readFileSync(join(blueprintsDir, file), 'utf8');
        const keys = extractNodeKeys(content);
        const nonUuid = keys.filter(k => k !== ROOT_SENTINEL && !UUID_V4_PATTERN.test(k));
        expect(nonUuid, `non-UUID ids found in ${file}`).toEqual([]);
      }
    });
  });
});
