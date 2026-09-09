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

// A revision is itself a recurrence report, so a labelled set-content inside a
// Findings subtree attaches a back-link to the enclosing finding on the same
// terms as an add-child: idempotent on the subject, app-owned because the
// session cannot set metadata.
//
// The evidence hook is add-child-shaped today — parent id plus created id, with
// "new finding" keyed on the parent being the root. A revision has neither, and
// must not fall into the new-finding branch, which would re-split a revised
// title into a title and a description child.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const SUBJECT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const OTHER_SUBJECT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';
const THIRD_SUBJECT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04';
const FINDINGS = 'ffffffff-ffff-ffff-ffff-ffffffffff05';
const FINDING_A = 'ffffffff-ffff-ffff-ffff-ffffffffff06';
const BACKLINK_A = 'ffffffff-ffff-ffff-ffff-ffffffffff07';
const DESCRIPTION_A = 'ffffffff-ffff-ffff-ffff-ffffffffff08';
const PLAIN = 'cccccccc-cccc-cccc-cccc-cccccccccc09';

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  actions?: { autoSave?: () => void };
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// FINDING_A carries a description and one back-link to SUBJECT: the state a
// later session meets when it comes to revise the wording.
function makeState(): TestState {
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [SUBJECT, OTHER_SUBJECT, THIRD_SUBJECT, FINDINGS, PLAIN]),
      [SUBJECT]: makeNode(SUBJECT, 'Story 001', []),
      [OTHER_SUBJECT]: makeNode(OTHER_SUBJECT, 'Story 002', []),
      [THIRD_SUBJECT]: makeNode(THIRD_SUBJECT, 'Story 003', []),
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
      [THIRD_SUBJECT]: [ROOT],
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
  const setState = vi.fn((partial: Partial<TestState>) => {
    state = { ...state, ...partial };
  });
  return {
    store: { getState: () => state, setState },
    setState,
    getCurrent: () => state,
  };
}

// A labelled set-content is routed at its target, so the subject the back-link
// points at has to ride on the request — an add-child gets it from the node
// argument, which a revision has spent on the target. Neither field exists yet;
// the cast is the red state, not a shortcut.
function revise(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any,
  subjectNodeId: string,
  targetNodeId: string,
  content: string,
  debriefDestinationId?: string,
) {
  const request = { kind: 'set-content', content, debriefDestinationId, subjectNodeId } as unknown as MutationRequest;
  return applyMutation(store, targetNodeId, request);
}

function childrenOf(state: TestState, nodeId: string): TreeNode[] {
  return state.nodes[nodeId].children.map((id) => state.nodes[id]);
}

function backlinksOf(state: TestState, nodeId: string): TreeNode[] {
  return childrenOf(state, nodeId).filter((n) => n.metadata.isHyperlink === true);
}

describe('back-link attach — revising a description line', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  it('writes the revised text', () => {
    const result = revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'The prompt names no output format', FINDINGS);

    expect(result.ok).toBe(true);
    expect(made.getCurrent().nodes[DESCRIPTION_A].content).toBe('The prompt names no output format');
  });

  it('attaches a back-link for the revising session', () => {
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'revised', FINDINGS);

    const links = backlinksOf(made.getCurrent(), FINDING_A);
    expect(links.map((n) => n.metadata.linkedNodeId)).toContain(OTHER_SUBJECT);
  });

  it('leaves the existing back-link in place, so the weight rises rather than resets', () => {
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'revised', FINDINGS);

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(2);
  });

  it('adds no second back-link when the same subject revises twice', () => {
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'first pass', FINDINGS);
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'second pass', FINDINGS);

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(2);
  });

  it('adds no back-link when the same session that first reported it revises', () => {
    revise(made.store, SUBJECT, DESCRIPTION_A, 'revised', FINDINGS);

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(1);
  });

  // The revised content and its evidence are one logical write; committing them
  // separately costs a second render and leaves a frame where the finding shows
  // revised text at its old weight.
  it('commits the revision and its evidence in a single store update', () => {
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'revised', FINDINGS);

    expect(made.setState).toHaveBeenCalledTimes(1);
  });

  it('carries three back-links after three sessions revise the same finding', () => {
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'second pass', FINDINGS);
    revise(made.store, THIRD_SUBJECT, DESCRIPTION_A, 'third pass', FINDINGS);

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(3);
    expect(made.getCurrent().nodes[DESCRIPTION_A].content).toBe('third pass');
  });
});

describe('back-link attach — revising a finding title', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  it('writes the new title', () => {
    revise(made.store, OTHER_SUBJECT, FINDING_A, 'Step prompts leave the output format to the session', FINDINGS);

    expect(made.getCurrent().nodes[FINDING_A].content).toBe('Step prompts leave the output format to the session');
  });

  it('attaches a back-link to the renamed finding', () => {
    revise(made.store, OTHER_SUBJECT, FINDING_A, 'A better headline', FINDINGS);

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(2);
  });

  it('keeps the description child, so the rename is not a rebuild', () => {
    revise(made.store, OTHER_SUBJECT, FINDING_A, 'A better headline', FINDINGS);

    expect(made.getCurrent().nodes[DESCRIPTION_A].content).toBe('The prompt named no output format');
  });

  // settleNewFinding splits the first line off as a title; a revision must not
  // reach that branch or a multi-line replacement grows a duplicate description.
  it('does not split a multi-line replacement into a title and a new description child', () => {
    revise(made.store, OTHER_SUBJECT, FINDING_A, 'A better headline\nwith a trailing line', FINDINGS);

    expect(childrenOf(made.getCurrent(), FINDING_A).filter((n) => !n.metadata.isHyperlink)).toHaveLength(1);
  });

  it('leaves the collapse stamp alone', () => {
    revise(made.store, OTHER_SUBJECT, FINDING_A, 'A better headline', FINDINGS);

    expect(made.getCurrent().nodes[FINDING_A].metadata.expanded).toBe(false);
  });
});

describe('back-link attach — writes the gate did not label', () => {
  let made: ReturnType<typeof makeFakeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    made = makeFakeStore();
  });

  it('attaches nothing to an unlabelled set-content inside a Findings subtree', () => {
    revise(made.store, OTHER_SUBJECT, DESCRIPTION_A, 'revised');

    expect(backlinksOf(made.getCurrent(), FINDING_A)).toHaveLength(1);
  });

  it('attaches nothing for a set-content outside any Findings subtree', () => {
    revise(made.store, OTHER_SUBJECT, PLAIN, 'revised', FINDINGS);

    expect(childrenOf(made.getCurrent(), PLAIN)).toHaveLength(0);
  });

  // The Findings root is inside its own granted subtree, so a revision can land
  // on it with no finding to attach evidence to. Whether the gate should refuse
  // the root outright is unsettled — but a landed one must never restructure the
  // register, which is what the new-finding branch of the shared hook would do.
  it('leaves the register intact when a revision lands on the Findings root', () => {
    revise(made.store, OTHER_SUBJECT, FINDINGS, 'Findings\nstray second line', FINDINGS);

    expect(made.getCurrent().nodes[FINDINGS].children).toEqual([FINDING_A]);
    expect(made.getCurrent().nodes[FINDINGS].content).toBe('Findings\nstray second line');
  });

  it.todo('refuses or records a revision of the Findings root itself');
});
