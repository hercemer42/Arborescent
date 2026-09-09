import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { executeInTerminal } from '../../../../services/terminalExecution';
import { notifyWorkflow } from '../workflowToast';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: vi.fn(),
  initializeFeedbackStore: vi.fn(),
  extractFeedbackContent: vi.fn(),
  cleanupFeedbackForFile: vi.fn().mockResolvedValue(undefined),
  cleanupFeedbackForNode: vi.fn().mockResolvedValue(undefined),
  findCollaboratingNode: vi.fn(),
}));

vi.mock('../workflowToast', () => ({
  notifyWorkflow: vi.fn(),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForNode: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearForFile: vi.fn(),
    clearForNode: vi.fn(),
  },
}));

// The session's read tools are hard-scoped to the bound node, so it cannot see
// the Findings node at all. The register has to arrive in the prompt: the
// destination id plus one line per existing finding, giving the session
// something to target by uuid. A step with no destination pays nothing.

const CTX_ID = 'collab-ctx';
const WORKFLOW = 'wwwwwwww-aaaa-aaaa-aaaa-aaaaaaaaaa00';
const STEP = 'ssssssss-aaaa-aaaa-aaaa-aaaaaaaaaa00';
const NODE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const FINDINGS = 'ffffffff-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const FINDING_A = 'ffffffff-aaaa-aaaa-aaaa-aaaaaaaaaa02';
const FINDING_B = 'ffffffff-aaaa-aaaa-aaaa-aaaaaaaaaa03';
const DANGLING = '99999999-9999-9999-9999-999999999999';

function makeNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata: { plugins: {}, ...metadata } };
}

interface StateArgs {
  debriefDestinationId?: string;
  withoutContext?: boolean;
}

function makeState({ debriefDestinationId, withoutContext }: StateArgs = {}): TreeState {
  const stepMetadata: Record<string, unknown> = { isBlueprint: true, stepType: 'autonomous' };
  if (debriefDestinationId !== undefined) stepMetadata.debriefDestinationId = debriefDestinationId;

  const nodes: Record<string, TreeNode> = {
    root: makeNode('root', 'Root', [WORKFLOW, CTX_ID, FINDINGS]),
    [WORKFLOW]: makeNode(WORKFLOW, 'Work', [STEP], { isWorkflow: true, isBlueprint: true }),
    [STEP]: makeNode(STEP, 'Debrief', [NODE_ID], stepMetadata),
    [NODE_ID]: makeNode(NODE_ID, 'Story 001', [], withoutContext ? {} : { appliedContextId: CTX_ID }),
    [CTX_ID]: makeNode(CTX_ID, 'Review context', [], { isContextDeclaration: true, collaborate: true, execute: true }),
    [FINDINGS]: makeNode(FINDINGS, 'Findings', [FINDING_A, FINDING_B], { isFindingsRoot: true }),
    [FINDING_A]: makeNode(FINDING_A, 'Step prompts under-specify their output', ['desc-a', 'link-a1', 'link-a2'], { expanded: false }),
    'desc-a': makeNode('desc-a', 'The prompt named no output format'),
    'link-a1': makeNode('link-a1', 'Seen in 001', [], { isHyperlink: true, linkedNodeId: NODE_ID }),
    'link-a2': makeNode('link-a2', 'Seen in 002', [], { isHyperlink: true, linkedNodeId: 'other' }),
    [FINDING_B]: makeNode(FINDING_B, 'Contexts fight the tool gate', ['desc-b'], { expanded: false }),
    'desc-b': makeNode('desc-b', 'A collaborate-only context refuses the write it invites'),
  };

  return {
    nodes,
    rootNodeId: 'root',
    treeType: 'workspace',
    ancestorRegistry: {
      root: [],
      [WORKFLOW]: ['root'],
      [STEP]: ['root', WORKFLOW],
      [NODE_ID]: ['root', WORKFLOW, STEP],
      [CTX_ID]: ['root'],
      [FINDINGS]: ['root'],
      [FINDING_A]: ['root', FINDINGS],
      'desc-a': ['root', FINDINGS, FINDING_A],
      'link-a1': ['root', FINDINGS, FINDING_A],
      'link-a2': ['root', FINDINGS, FINDING_A],
      [FINDING_B]: ['root', FINDINGS],
      'desc-b': ['root', FINDINGS, FINDING_B],
    },
    activeNodeId: null,
    multiSelectedNodeIds: new Set(),
    lastSelectedNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    currentFilePath: null,
    fileMeta: null,
    flashingNodeIds: new Set<string>(),
    flashingIntensity: 'light' as const,
    scrollToNodeId: null,
    deletingNodeIds: new Set<string>(),
    deleteAnimationCallback: null,
    reviews: {},
    feedbackFadingNodeIds: new Set(),
    contextDeclarations: [],
    blueprintModeEnabled: false,
    isFileBlueprintFile: false,
    summaryModeEnabled: false,
    summaryDateFrom: null,
    summaryDateTo: null,
    summaryVisibleNodeIds: null,
    workflowExecutionStates: {},
    workflowSessionMap: {},
    terminalNodeAssignments: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: {} as any,
    sessionRegistry: {},
  };
}

function makeClipboardEnv() {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.window = {
    electron: {
      terminalWrite: vi.fn().mockResolvedValue(undefined),
      startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
      stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
      createTempFile: vi.fn().mockResolvedValue('/tmp/feedback.md'),
      readTempFile: vi.fn().mockResolvedValue(null),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('sendActions — the debrief register block', () => {
  let executeMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    makeClipboardEnv();
    executeMock = executeInTerminal as Mock;
  });

  async function sentPrompt(args: StateArgs = {}): Promise<string> {
    const state = makeState(args);
    const mockGet = vi.fn(() => state);
    const mockSet = vi.fn((partial: Partial<TreeState> | ((s: TreeState) => Partial<TreeState>)) => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      Object.assign(state, update);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noOpVisualEffects: any = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };
    const actions = createSendActions(mockGet, mockSet, noOpVisualEffects, vi.fn(), vi.fn());

    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1', { collaborate: true, execute: true });

    expect(executeMock).toHaveBeenCalledTimes(1);
    return executeMock.mock.calls[0][1] as string;
  }

  describe('with a Findings node configured', () => {
    it('carries the Findings node id', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS });
      expect(sent).toContain(FINDINGS);
    });

    it('carries one register line per existing finding, each with its uuid', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS });
      expect(sent).toContain(FINDING_A);
      expect(sent).toContain(FINDING_B);
    });

    it('carries each finding title', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS });
      expect(sent).toContain('Step prompts under-specify their output');
      expect(sent).toContain('Contexts fight the tool gate');
    });

    it('carries no finding description, so the register stays affordable', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS });
      expect(sent).not.toContain('The prompt named no output format');
      expect(sent).not.toContain('A collaborate-only context refuses');
    });

    it('does not list back-links as findings', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS });
      expect(sent).not.toContain('link-a1');
    });
  });

  describe('with no Findings node configured', () => {
    it('adds no register block', async () => {
      const sent = await sentPrompt();
      expect(sent).not.toContain(FINDINGS);
      expect(sent).not.toContain('Step prompts under-specify their output');
    });

    it('raises no warning in the prompt itself', async () => {
      const sent = await sentPrompt();
      expect(sent).not.toMatch(/findings/i);
    });
  });

  describe('with a destination that no longer resolves', () => {
    it('omits the register block rather than sending a dangling id', async () => {
      const sent = await sentPrompt({ debriefDestinationId: DANGLING });
      expect(sent).not.toContain(DANGLING);
    });

    it('still sends the step, because a debrief never blocks a workflow', async () => {
      const sent = await sentPrompt({ debriefDestinationId: DANGLING });
      expect(sent).toContain('Story 001');
    });

    it('writes exactly one warning naming the step and the dangling id', async () => {
      await sentPrompt({ debriefDestinationId: DANGLING });

      expect(notifyWorkflow).toHaveBeenCalledTimes(1);
      const [message, level] = vi.mocked(notifyWorkflow).mock.calls[0];
      expect(message).toContain('Debrief');
      expect(message).toContain(DANGLING);
      expect(level).toBe('warning');
    });

    it('raises no warning when no destination is configured', async () => {
      await sentPrompt();

      expect(notifyWorkflow).not.toHaveBeenCalled();
    });

    it('raises no warning when the destination resolves', async () => {
      await sentPrompt({ debriefDestinationId: FINDINGS });

      expect(notifyWorkflow).not.toHaveBeenCalled();
    });
  });

  // Every write into the Findings subtree is refused when the step resolves no
  // applied context: the gate denies by default there, and the session has no
  // recovery path. Sending a register the session cannot act on would lose the
  // debrief in silence, so the block is dropped and the mistake is announced.
  describe('with no applied context', () => {
    it('omits the register', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS, withoutContext: true });

      expect(sent).not.toContain(FINDINGS);
    });

    it('warns that the findings cannot land', async () => {
      await sentPrompt({ debriefDestinationId: FINDINGS, withoutContext: true });

      expect(notifyWorkflow).toHaveBeenCalledTimes(1);
      expect(vi.mocked(notifyWorkflow).mock.calls[0][0]).toMatch(/context/i);
    });

    it('still sends the node content', async () => {
      const sent = await sentPrompt({ debriefDestinationId: FINDINGS, withoutContext: true });

      expect(sent).toContain('Story 001');
    });
  });
});
