import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';

import { getFindingWeight, buildFindingsRegister, renderFindingsRegister } from '../findings';

// A finding's weight is its back-link count, derived at render time from the
// tree and never persisted. The register carries uuid, title and weight only —
// identifying which finding to update needs nothing more, and descriptions
// would make every debrief prompt pay for text the session cannot act on.

const FINDINGS = 'ffffffff-0000-0000-0000-000000000001';
const FINDING_A = 'ffffffff-0000-0000-0000-00000000000a';
const FINDING_B = 'ffffffff-0000-0000-0000-00000000000b';
const SUBJECT_1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const SUBJECT_2 = 'aaaaaaaa-0000-0000-0000-000000000002';

function makeNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata };
}

function backlink(id: string, target: string): TreeNode {
  return makeNode(id, 'Seen here', [], { isHyperlink: true, linkedNodeId: target });
}

// FINDING_A: one description child + two back-links -> weight 2.
// FINDING_B: one description child, no back-links      -> weight 0.
function makeNodes(): Record<string, TreeNode> {
  return {
    [FINDINGS]: makeNode(FINDINGS, 'Findings', [FINDING_A, FINDING_B], { isFindingsRoot: true }),
    [FINDING_A]: makeNode(FINDING_A, 'Step prompts under-specify their output', ['desc-a', 'link-a1', 'link-a2'], { expanded: false }),
    'desc-a': makeNode('desc-a', 'The prompt named no output format, so the session invented one'),
    'link-a1': backlink('link-a1', SUBJECT_1),
    'link-a2': backlink('link-a2', SUBJECT_2),
    [FINDING_B]: makeNode(FINDING_B, 'Contexts fight the tool gate', ['desc-b'], { expanded: false }),
    'desc-b': makeNode('desc-b', 'A collaborate-only context refuses the write it invites'),
  };
}

describe('getFindingWeight', () => {
  it('counts a finding back-links', () => {
    expect(getFindingWeight(FINDING_A, makeNodes())).toBe(2);
  });

  it('does not count description children', () => {
    const nodes = makeNodes();
    nodes[FINDING_A] = { ...nodes[FINDING_A], children: ['desc-a', 'link-a1'] };
    expect(getFindingWeight(FINDING_A, nodes)).toBe(1);
  });

  it('is zero for a finding carrying no back-link', () => {
    expect(getFindingWeight(FINDING_B, makeNodes())).toBe(0);
  });

  it('is zero for a node with no children at all', () => {
    const nodes = makeNodes();
    nodes[FINDING_B] = { ...nodes[FINDING_B], children: [] };
    expect(getFindingWeight(FINDING_B, nodes)).toBe(0);
  });

  it('is zero for an id that resolves to no node', () => {
    expect(getFindingWeight('missing', makeNodes())).toBe(0);
  });

  it('ignores a child id that resolves to no node, rather than counting or throwing', () => {
    const nodes = makeNodes();
    nodes[FINDING_A] = { ...nodes[FINDING_A], children: ['desc-a', 'link-a1', 'evaporated'] };
    expect(getFindingWeight(FINDING_A, nodes)).toBe(1);
  });

  it('counts a back-link whose target node is gone, because the evidence is the link not the target', () => {
    const nodes = makeNodes();
    nodes['link-a2'] = backlink('link-a2', 'deleted-subject');
    expect(getFindingWeight(FINDING_A, nodes)).toBe(2);
  });
});

describe('buildFindingsRegister', () => {
  it('returns one entry per direct child of the Findings node, with id, title and weight', () => {
    expect(buildFindingsRegister(FINDINGS, makeNodes())).toEqual([
      { id: FINDING_A, title: 'Step prompts under-specify their output', weight: 2 },
      { id: FINDING_B, title: 'Contexts fight the tool gate', weight: 0 },
    ]);
  });

  it('lists only direct children — a description under a finding is never a register entry', () => {
    const entries = buildFindingsRegister(FINDINGS, makeNodes());
    expect(entries.map((e) => e.id)).not.toContain('desc-a');
    expect(entries.map((e) => e.id)).not.toContain('link-a1');
  });

  // A link is never a finding, and the gate refuses writes beneath one, so
  // advertising it in the register would hand the session an unusable target.
  it('excludes a hyperlink child of the Findings node itself', () => {
    const nodes = makeNodes();
    nodes['stray-link'] = backlink('stray-link', SUBJECT_1);
    nodes[FINDINGS] = { ...nodes[FINDINGS], children: [FINDING_A, 'stray-link', FINDING_B] };

    expect(buildFindingsRegister(FINDINGS, nodes).map((e) => e.id)).toEqual([FINDING_A, FINDING_B]);
  });

  it('takes the first non-empty line of a multi-line finding as its title', () => {
    const nodes = makeNodes();
    nodes[FINDING_B] = { ...nodes[FINDING_B], content: 'The headline\nA body the register must not carry.' };

    const entry = buildFindingsRegister(FINDINGS, nodes).find((e) => e.id === FINDING_B);
    expect(entry?.title).toBe('The headline');
  });

  it('preserves the order of the Findings node children', () => {
    const nodes = makeNodes();
    nodes[FINDINGS] = { ...nodes[FINDINGS], children: [FINDING_B, FINDING_A] };
    expect(buildFindingsRegister(FINDINGS, nodes).map((e) => e.id)).toEqual([FINDING_B, FINDING_A]);
  });

  it('is empty for a Findings node with no findings yet', () => {
    const nodes = makeNodes();
    nodes[FINDINGS] = { ...nodes[FINDINGS], children: [] };
    expect(buildFindingsRegister(FINDINGS, nodes)).toEqual([]);
  });

  it('is empty when the destination id resolves to no node', () => {
    expect(buildFindingsRegister('missing', makeNodes())).toEqual([]);
  });

  it('is empty for an undefined destination id', () => {
    expect(buildFindingsRegister(undefined, makeNodes())).toEqual([]);
  });

  it('is neither capped nor truncated at 200 findings', () => {
    const nodes = makeNodes();
    const ids = Array.from({ length: 200 }, (_, i) => `finding-${i}`);
    for (const id of ids) nodes[id] = makeNode(id, `Problem ${id}`, []);
    nodes[FINDINGS] = { ...nodes[FINDINGS], children: ids };

    expect(buildFindingsRegister(FINDINGS, nodes)).toHaveLength(200);
  });
});

describe('renderFindingsRegister', () => {
  it('renders one line per finding, each carrying the uuid, the title and the weight', () => {
    const lines = renderFindingsRegister(FINDINGS, makeNodes()).trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(FINDING_A);
    expect(lines[0]).toContain('Step prompts under-specify their output');
    expect(lines[0]).toMatch(/\b2\b/);
    expect(lines[1]).toContain(FINDING_B);
    expect(lines[1]).toMatch(/\b0\b/);
  });

  it('carries no description text', () => {
    const rendered = renderFindingsRegister(FINDINGS, makeNodes());

    expect(rendered).not.toContain('The prompt named no output format');
    expect(rendered).not.toContain('A collaborate-only context refuses');
  });

  it('renders one line per finding even when a finding carries a multi-line body', () => {
    const nodes = makeNodes();
    nodes[FINDING_B] = { ...nodes[FINDING_B], content: 'The headline\nA body the register must not carry.' };

    const rendered = renderFindingsRegister(FINDINGS, nodes);

    expect(rendered.trim().split('\n')).toHaveLength(2);
    expect(rendered).not.toContain('A body the register must not carry');
  });

  it('renders 200 lines with no truncation marker', () => {
    const nodes = makeNodes();
    const ids = Array.from({ length: 200 }, (_, i) => `finding-${i}`);
    for (const id of ids) nodes[id] = makeNode(id, `Problem ${id}`, []);
    nodes[FINDINGS] = { ...nodes[FINDINGS], children: ids };

    const rendered = renderFindingsRegister(FINDINGS, nodes);

    expect(rendered.trim().split('\n')).toHaveLength(200);
    expect(rendered).not.toMatch(/truncat|\.\.\.|and \d+ more/i);
  });

  it('renders an empty string for a Findings node with no findings, so the send path adds no block', () => {
    const nodes = makeNodes();
    nodes[FINDINGS] = { ...nodes[FINDINGS], children: [] };
    expect(renderFindingsRegister(FINDINGS, nodes)).toBe('');
  });

  it('renders an empty string when the destination resolves to no node', () => {
    expect(renderFindingsRegister('missing', makeNodes())).toBe('');
  });

  it('renders an empty string for an undefined destination', () => {
    expect(renderFindingsRegister(undefined, makeNodes())).toBe('');
  });
});
