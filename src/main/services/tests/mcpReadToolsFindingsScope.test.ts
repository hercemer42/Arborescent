import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createReadTools, ReadTools, ToolResult, TreeReadState, TreeReadResult } from '../mcpReadTools';
import { MCP_ERROR_CODES } from '../../../shared/utils/mcpErrorCodes';
import { TreeNode } from '../../../shared/types';

// get_tree gains an optional node id. Until now every read has been
// bound-node-only, and that invariant is load-bearing in how a session is
// reasoned about, so the parameter is honoured only where the story 001 grant
// exists and only for the bound subtree or the granted Findings subtree.
//
// The read state already carries every node in the file: bound-node-only was
// enforced by which id got serialised, never by what was fetched. These tests
// therefore pin a gate, not a new data path.

type GetTreeByNodeId = (args: { sessionId: string; nodeId?: string; depth?: number }) => Promise<ToolResult>;

// The parameter does not exist yet; the cast is the red state, not a shortcut.
function getTree(tools: ReadTools): GetTreeByNodeId {
  return tools.getTree as unknown as GetTreeByNodeId;
}

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const SIBLING = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const CHILD = 'ffffffff-ffff-ffff-ffff-ffffffffff06';
const FINDINGS = '11111111-1111-1111-1111-111111111107';
const FINDING_A = '22222222-2222-2222-2222-222222222208';
const BACKLINK_A = '33333333-3333-3333-3333-333333333309';
const DESCRIPTION_A = '44444444-4444-4444-4444-444444444410';
const FINDING_B = '66666666-6666-6666-6666-666666666612';
const DESCRIPTION_B = '77777777-7777-7777-7777-777777777713';
const WORKFLOW = '55555555-5555-5555-5555-555555555511';
const DANGLING = '99999999-9999-9999-9999-999999999999';

interface SetupArgs {
  stepType?: 'manual' | 'checkpoint' | 'autonomous';
  debriefDestinationId?: string;
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// Two findings, so a fetch can be shown to return one of them rather than the
// register. FINDINGS sits outside the bound subtree, under ROOT.
function makeState({ stepType = 'autonomous', debriefDestinationId }: SetupArgs): TreeReadState {
  const stepMetadata: TreeNode['metadata'] = { stepType };
  if (debriefDestinationId !== undefined) stepMetadata.debriefDestinationId = debriefDestinationId;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [WORKFLOW, CTX, FINDINGS]),
      [WORKFLOW]: makeNode(WORKFLOW, 'Work', [STEP], { isWorkflow: true }),
      [STEP]: makeNode(STEP, 'Step', [BOUND, SIBLING], stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound', [CHILD], { appliedContextId: CTX }),
      [CHILD]: makeNode(CHILD, 'Item under bound', []),
      [SIBLING]: makeNode(SIBLING, 'Sibling outside bound subtree', []),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: true }),
      [FINDINGS]: makeNode(FINDINGS, 'Findings', [FINDING_A, FINDING_B], { isFindingsRoot: true }),
      [FINDING_A]: makeNode(FINDING_A, 'Step prompts under-specify their output', [DESCRIPTION_A, BACKLINK_A], { expanded: false }),
      [DESCRIPTION_A]: makeNode(DESCRIPTION_A, 'The prompt named no output format', []),
      [BACKLINK_A]: makeNode(BACKLINK_A, 'Seen in 001', [], { isHyperlink: true, linkedNodeId: BOUND }),
      [FINDING_B]: makeNode(FINDING_B, 'The gate refuses before the mode table', [DESCRIPTION_B], { expanded: false }),
      [DESCRIPTION_B]: makeNode(DESCRIPTION_B, 'A context-less step loses every write', []),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [WORKFLOW]: [ROOT],
      [STEP]: [ROOT, WORKFLOW],
      [BOUND]: [ROOT, WORKFLOW, STEP],
      [CHILD]: [ROOT, WORKFLOW, STEP, BOUND],
      [SIBLING]: [ROOT, WORKFLOW, STEP],
      [CTX]: [ROOT],
      [FINDINGS]: [ROOT],
      [FINDING_A]: [ROOT, FINDINGS],
      [DESCRIPTION_A]: [ROOT, FINDINGS, FINDING_A],
      [BACKLINK_A]: [ROOT, FINDINGS, FINDING_A],
      [FINDING_B]: [ROOT, FINDINGS],
      [DESCRIPTION_B]: [ROOT, FINDINGS, FINDING_B],
    },
  };
}

function bind(setup: SetupArgs): ReadTools {
  const registry = new SessionBindingRegistry();
  const state = makeState(setup);
  const deps = {
    bindingRegistry: registry,
    treeReader: {
      readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> =>
        state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' },
      ),
    },
  };
  registry.register('sess-1', BOUND);
  return createReadTools(deps);
}

interface SerializedNode {
  id: string;
  content: string;
  children: SerializedNode[];
}

function payloadOf(result: ToolResult): SerializedNode {
  return JSON.parse(result.content[0].text) as SerializedNode;
}

describe('get_tree by node id — reading a finding the register named', () => {
  let tools: ReadTools;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = bind({ debriefDestinationId: FINDINGS });
  });

  it('returns the finding subtree the id names', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A });

    expect(result.isError).toBeFalsy();
    expect(payloadOf(result).id).toBe(FINDING_A);
  });

  it('returns the description the register omits', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A });

    const contents = payloadOf(result).children.map((c) => c.content);
    expect(contents).toContain('The prompt named no output format');
  });

  // The register carries titles and weights only; a debrief that touches two
  // findings pays for two subtrees rather than for the whole register.
  it('returns only the named finding, never its siblings in the register', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A });

    const payload = payloadOf(result);
    expect(payload.id).toBe(FINDING_A);
    expect(JSON.stringify(payload)).not.toContain(FINDING_B);
  });

  it('fetches the second finding as its own subtree', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_B });

    expect(payloadOf(result).id).toBe(FINDING_B);
  });

  it('honours depth on a node-id fetch', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A, depth: 0 });

    const payload = payloadOf(result);
    expect(payload.id).toBe(FINDING_A);
    expect(payload.children).toEqual([]);
  });

  it('still returns the bound subtree when no node id is given', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1' });

    expect(payloadOf(result).id).toBe(BOUND);
  });

  it('accepts an id inside the bound subtree', async () => {
    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: CHILD });

    expect(result.isError).toBeFalsy();
    expect(payloadOf(result).id).toBe(CHILD);
  });
});

describe('get_tree by node id — refusals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses an id in neither the bound subtree nor the granted Findings subtree', async () => {
    const tools = bind({ debriefDestinationId: FINDINGS });

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: SIBLING });

    expect(result.isError).toBe(true);
  });

  // The read/* codes describe a tree that could not be reached, and a client
  // branching on one may sensibly retry. A refusal is permanent.
  it('codes a refusal as out-of-scope rather than as an unreachable tree', async () => {
    const tools = bind({ debriefDestinationId: FINDINGS });

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: SIBLING });

    expect((result.structuredContent as { code?: string }).code).toBe(MCP_ERROR_CODES.writeOutsideBoundSubtree);
  });

  it('names the hyperlink when refusing a back-link, rather than reporting it out of scope', async () => {
    const tools = bind({ debriefDestinationId: FINDINGS });

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: BACKLINK_A });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/hyperlink/i);
  });

  // Serialising an unknown id yields null today, which reads back as an empty
  // finding rather than as a mistake.
  it('refuses an id that resolves to no node rather than answering with null', async () => {
    const tools = bind({ debriefDestinationId: FINDINGS });

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: DANGLING });

    expect(result.isError).toBe(true);
  });

  it('refuses a Findings id when the step declares no Findings node', async () => {
    const tools = bind({});

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A });

    expect(result.isError).toBe(true);
  });

  // The grant gates the parameter itself: without a Findings node the read is
  // bound-node-only, exactly as it is today.
  it('refuses a bound-subtree id when the step declares no Findings node', async () => {
    const tools = bind({});

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: CHILD });

    expect(result.isError).toBe(true);
  });

  it('still returns the bound subtree with no node id when the step declares no Findings node', async () => {
    const tools = bind({});

    const result = await getTree(tools)({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(payloadOf(result).id).toBe(BOUND);
  });

  it('refuses a Findings id when the configured destination resolves to no node', async () => {
    const tools = bind({ debriefDestinationId: DANGLING });

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A });

    expect(result.isError).toBe(true);
  });

  it('refuses a Findings id once the workflow declaration is gone from the step ancestry', async () => {
    const registry = new SessionBindingRegistry();
    const state = makeState({ debriefDestinationId: FINDINGS });
    delete state.nodes[WORKFLOW].metadata.isWorkflow;
    registry.register('sess-1', BOUND);
    const tools = createReadTools({
      bindingRegistry: registry,
      treeReader: {
        readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> =>
          state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' },
        ),
      },
    });

    const result = await getTree(tools)({ sessionId: 'sess-1', nodeId: FINDING_A });

    expect(result.isError).toBe(true);
  });

  // Reads carry no route distinction, so a destination surviving a step-type
  // change reaches a step whose writes could never land. Whether the read
  // should follow the write's autonomous-only rule is unsettled.
  it.todo('refuses a Findings id on a manual step, where the matching write cannot land');
});
