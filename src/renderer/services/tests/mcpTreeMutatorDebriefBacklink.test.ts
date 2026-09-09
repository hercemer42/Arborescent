import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../store/storeOwnership', () => ({
  findStoreOwningSession: vi.fn(),
}));

import { applyMutation } from '../mcpTreeMutatorService';
import { TreeNode } from '../../../shared/types';
import type { MutationRequest } from '../../../shared/types/electronApi';

// The session writes findings with add_child_node and nothing else — it cannot
// set metadata, so it can never create a back-link. The app owns the evidence:
// on a write landing inside a Findings subtree it attaches a hyperlink child to
// the touched finding, keyed for idempotency on linkedNodeId equality with the
// step subject, and stamps a newly created finding collapsed.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const SUBJECT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const OTHER_SUBJECT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';
const FINDINGS = 'ffffffff-ffff-ffff-ffff-ffffffffff04';
const FINDING_A = 'ffffffff-ffff-ffff-ffff-ffffffffff05';
const BACKLINK_A = 'ffffffff-ffff-ffff-ffff-ffffffffff06';
const DESCRIPTION_A = 'ffffffff-ffff-ffff-ffff-ffffffffff07';
const PLAIN = 'cccccccc-cccc-cccc-cccc-cccccccccc08';

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  actions?: { autoSave?: () => void };
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// FINDING_A already carries a description and one back-link to SUBJECT, which
// is the state a re-sent or resumed debrief step meets.
function makeState(): TestState {
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [SUBJECT, OTHER_SUBJECT, FINDINGS, PLAIN]),
      [SUBJECT]: makeNode(SUBJECT, 'Story 001', []),
      [OTHER_SUBJECT]: makeNode(OTHER_SUBJECT, 'Story 002', []),
      [FINDINGS]: makeNode(FINDINGS, 'Findings', [FINDING_A], { isFindingsRoot: true }),
      [FINDING_A]: makeNode(FINDING_A, 'Step prompts under-specify their output', [DESCRIPTION_A, BACKLINK_A], { expanded: false }),
      [DESCRIPTION_A]: makeNode(DESCRIPTION_A, 'The prompt named no output format', []),
      [BACKLINK_A]: makeNode(BACKLINK_A, 'Seen in 001', [], { isHyperlink: true, linkedNodeId: SUBJECT }),
      [PLAIN]: makeNode(PLAIN, 'An ordinary branch', []),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [SUBJECT]: [ROOT],
      [OTHER_SUBJECT]: [ROOT],
      [FINDINGS]: [ROOT],
      [FINDING_A]: [ROOT, FINDINGS],
      [DESCRIPTION_A]: [ROOT, FINDINGS, FINDING_A],
      [BACKLINK_A]: [ROOT, FINDINGS, FINDING_A],
      [PLAIN]: [ROOT],
    },
  };
}

function makeFakeStore() {
  const autoSave = vi.fn();
  let state: TestState = { ...makeState(), actions: { autoSave } };
  return {
    store: {
      getState: () => state,
      setState: (partial: Partial<TestState>) => {
        state = { ...state, ...partial };
      },
    },
    getCurrent: () => state,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAs(store: any, nodeId: string, request: MutationRequest) {
  return applyMutation(store, nodeId, request);
}

function childrenOf(state: TestState, nodeId: string): TreeNode[] {
  return state.nodes[nodeId].children.map((id) => state.nodes[id]);
}

function backlinksOf(state: TestState, nodeId: string): TreeNode[] {
  return childrenOf(state, nodeId).filter((n) => n.metadata.isHyperlink === true);
}

function addedFinding(state: TestState, content: string): TreeNode {
  const match = childrenOf(state, FINDINGS).find((n) => n.content === content);
  if (!match) throw new Error(`no finding titled ${content}`);
  return match;
}

describe('back-link attach — a new finding', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  it('creates the finding as a child of the Findings node', () => {
    const result = applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content: 'A fresh problem' });

    expect(result.ok).toBe(true);
    expect(childrenOf(made.getCurrent(), FINDINGS).map((n) => n.content)).toContain('A fresh problem');
  });

  it('attaches exactly one back-link pointing at the step subject', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content: 'A fresh problem' });

    const links = backlinksOf(made.getCurrent(), addedFinding(made.getCurrent(), 'A fresh problem').id);
    expect(links).toHaveLength(1);
    expect(links[0].metadata.linkedNodeId).toBe(SUBJECT);
    expect(links[0].metadata.isHyperlink).toBe(true);
  });

  it('stamps the new finding collapsed so the Findings node reads as a flat list', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content: 'A fresh problem' });

    expect(addedFinding(made.getCurrent(), 'A fresh problem').metadata.expanded).toBe(false);
  });

  it('registers the back-link in the ancestor registry under its finding', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content: 'A fresh problem' });

    const state = made.getCurrent();
    const finding = addedFinding(state, 'A fresh problem');
    const link = backlinksOf(state, finding.id)[0];
    expect(state.ancestorRegistry[link.id]).toContain(finding.id);
  });

  it('does not attach a back-link to the Findings node itself', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content: 'A fresh problem' });

    expect(backlinksOf(made.getCurrent(), FINDINGS)).toHaveLength(0);
  });

  it('gives the back-link no back-link of its own', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content: 'A fresh problem' });

    const state = made.getCurrent();
    const link = backlinksOf(state, addedFinding(state, 'A fresh problem').id)[0];
    expect(state.nodes[link.id].children).toEqual([]);
  });
});

describe('back-link attach — a recurrence against an existing finding', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  it('adds a second back-link when a different subject reports the same finding', () => {
    applyAs(made.store, OTHER_SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'seen again in 002' });

    const links = backlinksOf(made.getCurrent(), FINDING_A);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.metadata.linkedNodeId)).toEqual([SUBJECT, OTHER_SUBJECT]);
  });

  it('attaches the back-link to the touched finding, not to the Findings node', () => {
    applyAs(made.store, OTHER_SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'seen again in 002' });

    expect(backlinksOf(made.getCurrent(), FINDINGS)).toHaveLength(0);
  });

  it('adds no second back-link when the same subject writes again — a re-sent step cannot inflate a weight', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'more detail' });

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(1);
  });

  it('stays at one back-link across three writes from the same subject', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'detail one' });
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'detail two' });
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'detail three' });

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(1);
  });

  it('still records the written child itself, so idempotency costs no content', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'more detail' });

    expect(childrenOf(made.getCurrent(), FINDING_A).map((n) => n.content)).toContain('more detail');
  });

  it('does not stamp a description child collapsed — only a finding is collapsed on creation', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDING_A, debriefDestinationId: FINDINGS, content: 'more detail' });

    const written = childrenOf(made.getCurrent(), FINDING_A).find((n) => n.content === 'more detail');
    expect(written?.metadata.expanded).toBeUndefined();
  });
});

describe('back-link attach — writes outside a Findings subtree', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  it('attaches nothing on an ordinary add-child', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: PLAIN, content: 'an ordinary note' });

    const state = made.getCurrent();
    expect(state.nodes[PLAIN].children).toHaveLength(1);
    expect(backlinksOf(state, PLAIN)).toHaveLength(0);
  });

  it('leaves an ordinary child expanded by default', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: PLAIN, content: 'an ordinary note' });

    const written = childrenOf(made.getCurrent(), PLAIN)[0];
    expect(written.metadata.expanded).toBeUndefined();
  });

  it('leaves every existing weight untouched', () => {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: PLAIN, content: 'an ordinary note' });

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(1);
  });

  // The gate only labels a write whose parent sits inside the destination, so
  // this is unreachable through it — the guard keeps a mismatched label from
  // resolving to the topmost ancestor and hanging a link on the root.
  it('attaches nothing when a labelled write lands outside the labelled destination', () => {
    applyAs(made.store, SUBJECT, {
      kind: 'add-child',
      parentId: PLAIN,
      debriefDestinationId: FINDINGS,
      content: 'mislabelled',
    });

    const state = made.getCurrent();
    expect(backlinksOf(state, ROOT)).toHaveLength(0);
    expect(backlinksOf(state, PLAIN)).toHaveLength(0);
    expect(childrenOf(state, PLAIN).map((n) => n.content)).toContain('mislabelled');
  });

  it('attaches nothing for a set-content mutation inside the Findings subtree', () => {
    applyAs(made.store, SUBJECT, { kind: 'set-content', content: 'retitled by hand' });

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(1);
  });

  it('attaches nothing to an unlabelled write into the Findings subtree, and leaves its content whole', () => {
    applyAs(made.store, SUBJECT, {
      kind: 'add-child',
      parentId: FINDINGS,
      content: 'Not a debrief\nsecond line',
    });

    const written = childrenOf(made.getCurrent(), FINDINGS).find((n) => n.content.startsWith('Not a debrief'));
    expect(written?.content).toBe('Not a debrief\nsecond line');
    expect(written?.children).toEqual([]);
    expect(written?.metadata.expanded).toBeUndefined();
  });
});

// The session cannot learn the uuid of the finding it just created:
// add_child_node answers {applied:true} and the read tools take no node
// argument. So it writes the finding as one node — first line the headline,
// the rest the description — and the app splits it.
describe('title and description in one write', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  function write(content: string) {
    applyAs(made.store, SUBJECT, { kind: 'add-child', parentId: FINDINGS, debriefDestinationId: FINDINGS, content });
  }

  it('keeps only the first line as the finding title', () => {
    write('Step prompts drift from the gate\nThe prompt invited a write the gate refuses.');

    expect(childrenOf(made.getCurrent(), FINDINGS).map((n) => n.content)).toContain(
      'Step prompts drift from the gate',
    );
  });

  it('hangs the remainder under the finding as its description', () => {
    write('Step prompts drift from the gate\nThe prompt invited a write the gate refuses.');

    const finding = addedFinding(made.getCurrent(), 'Step prompts drift from the gate');
    const description = childrenOf(made.getCurrent(), finding.id).find((n) => !n.metadata.isHyperlink);
    expect(description?.content).toBe('The prompt invited a write the gate refuses.');
  });

  it('keeps a multi-paragraph description in one node', () => {
    write('A title\nFirst paragraph.\n\nSecond paragraph.');

    const finding = addedFinding(made.getCurrent(), 'A title');
    const description = childrenOf(made.getCurrent(), finding.id).find((n) => !n.metadata.isHyperlink);
    expect(description?.content).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('skips leading blank lines when taking the headline', () => {
    write('\n\nA title after blanks\nThe description.');

    const finding = addedFinding(made.getCurrent(), 'A title after blanks');
    const description = childrenOf(made.getCurrent(), finding.id).find((n) => !n.metadata.isHyperlink);
    expect(description?.content).toBe('The description.');
  });

  it('treats a single-line write as a title-only finding', () => {
    write('Just the headline');

    const finding = addedFinding(made.getCurrent(), 'Just the headline');
    expect(childrenOf(made.getCurrent(), finding.id).filter((n) => !n.metadata.isHyperlink)).toHaveLength(0);
  });

  it('attaches exactly one back-link to the finding produced by a split write', () => {
    write('A title\nA description.');

    const finding = addedFinding(made.getCurrent(), 'A title');
    expect(backlinksOf(made.getCurrent(), finding.id)).toHaveLength(1);
  });

  it('collapses a split finding, so the description is one keystroke away', () => {
    write('A title\nA description.');

    expect(addedFinding(made.getCurrent(), 'A title').metadata.expanded).toBe(false);
  });

  it('does not split a write under an existing finding — only a finding carries a headline', () => {
    applyAs(made.store, SUBJECT, {
      kind: 'add-child',
      parentId: FINDING_A,
      debriefDestinationId: FINDINGS,
      content: 'First line\nsecond line',
    });

    expect(childrenOf(made.getCurrent(), FINDING_A).map((n) => n.content)).toContain('First line\nsecond line');
  });
});
