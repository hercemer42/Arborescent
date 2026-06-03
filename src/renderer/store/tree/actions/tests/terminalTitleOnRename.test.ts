import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createNodeActions } from '../nodeActions';
import { useTerminalStore } from '../../../terminal/terminalStore';
import type { AncestorRegistry } from '../../../../utils/ancestry';

// Bug: when a Claude session first binds a node to a terminal, the title
// is synced via extractTaskTitle (covered by terminalTitleOnBind). After
// the initial bind the title freezes — renaming the bound origin/root
// node never refreshes the terminal tab. This test pins the contract
// that subsequent renames on the bound origin propagate to the terminal
// title using the same extractor and the same empty/whitespace guard as
// the bind path.

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('@/store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const FILE_PATH = '/project.arbo';

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  collaboratingNodeId: string | null;
  blueprintModeEnabled: boolean;
  actions?: {
    executeCommand?: (cmd: { execute: () => void }) => void;
    refreshContextDeclarations?: () => void;
  };
};

function buildState(): TestState {
  return {
    nodes: {
      origin: { id: 'origin', content: 'Bound origin', children: ['child'], metadata: {} },
      child: { id: 'child', content: 'Child of origin', children: [], metadata: {} },
      otherOrigin: { id: 'otherOrigin', content: 'Other origin', children: [], metadata: {} },
      unbound: { id: 'unbound', content: 'Unbound sibling', children: [], metadata: {} },
    },
    rootNodeId: 'origin',
    ancestorRegistry: {
      origin: [],
      child: ['origin'],
      otherOrigin: [],
      unbound: [],
    },
    activeNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    collaboratingNodeId: null,
    blueprintModeEnabled: false,
  };
}

type TerminalSeed = { id: string; title: string; originNodeId?: string };

function setTerminals(seeds: TerminalSeed[]): void {
  const terminals = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    cwd: '/tmp',
    originNodeId: s.originNodeId,
  })) as unknown as ReturnType<typeof useTerminalStore.getState>['terminals'];

  useTerminalStore.setState({
    terminals,
    activeTerminalId: seeds[0]?.id ?? null,
    currentFilePath: FILE_PATH,
    fileStates: {
      [FILE_PATH]: {
        terminals,
        activeTerminalId: seeds[0]?.id ?? null,
      },
    },
  });
}

function titleOf(terminalId: string): string | undefined {
  return useTerminalStore.getState().terminals.find((t) => t.id === terminalId)?.title;
}

function fileBucketTitleOf(terminalId: string): string | undefined {
  return useTerminalStore
    .getState()
    .fileStates[FILE_PATH]?.terminals.find((t) => t.id === terminalId)?.title;
}

function createActions(stateRef: { current: TestState }) {
  const get = () => stateRef.current;
  const set = (partial: Partial<TestState> | ((s: TestState) => Partial<TestState>)) => {
    const next = typeof partial === 'function' ? partial(stateRef.current) : partial;
    stateRef.current = { ...stateRef.current, ...next };
  };
  const executeCommand = vi.fn((cmd: { execute: () => void }) => cmd.execute());
  return createNodeActions(
    get,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set as any,
    vi.fn(),
    { executeCommand }
  );
}

describe('terminal title syncs with bound root rename — happy path', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildState() };
    actions = createActions(stateRef);
  });

  it('updates the bound terminal title to the new first non-blank line on rename', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', 'Renamed origin');

    expect(titleOf('term-1')).toBe('Renamed origin');
  });

  it('propagates the update to the per-file fileStates bucket as well as the active mirror', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', 'Renamed origin');

    expect(fileBucketTitleOf('term-1')).toBe('Renamed origin');
  });

  it('uses the first non-blank line when the renamed content has leading whitespace lines', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', '\n\n  Real title  \nbody');

    expect(titleOf('term-1')).toBe('Real title');
  });

  it('trims trailing whitespace on the extracted title line', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', '  Trimmed title   \nrest');

    expect(titleOf('term-1')).toBe('Trimmed title');
  });
});

describe('terminal title syncs with bound root rename — scoping', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildState() };
    actions = createActions(stateRef);
  });

  it('with two terminals bound to two different origins, renaming one updates only that terminal', () => {
    setTerminals([
      { id: 'term-1', title: 'Bound origin', originNodeId: 'origin' },
      { id: 'term-2', title: 'Other origin', originNodeId: 'otherOrigin' },
    ]);

    actions.updateContent('origin', 'Renamed origin');

    expect(titleOf('term-1')).toBe('Renamed origin');
    expect(titleOf('term-2')).toBe('Other origin');
  });

  it('renaming a descendant of a bound root leaves every terminal title unchanged', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('child', 'Renamed child');

    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('renaming an unbound, unrelated node leaves every terminal title unchanged', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('unbound', 'Renamed unbound');

    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('does not touch terminals that have no originNodeId set', () => {
    setTerminals([
      { id: 'term-1', title: 'Free terminal' },
      { id: 'term-2', title: 'Bound origin', originNodeId: 'origin' },
    ]);

    actions.updateContent('origin', 'Renamed origin');

    expect(titleOf('term-1')).toBe('Free terminal');
    expect(titleOf('term-2')).toBe('Renamed origin');
  });
});

describe('terminal title syncs with bound root rename — empty / whitespace guard', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildState() };
    actions = createActions(stateRef);
  });

  it('renaming the bound root to empty content leaves the existing terminal title intact', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', '');

    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('renaming the bound root to whitespace-only content leaves the existing terminal title intact', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', '   \n\t\n  ');

    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('a transient empty rename does not blank the title — a later real rename still propagates', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', '');
    expect(titleOf('term-1')).toBe('Bound origin');

    actions.updateContent('origin', 'Real title');
    expect(titleOf('term-1')).toBe('Real title');
  });
});

describe('terminal title syncs with bound root rename — no-op guard (hot path)', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildState() };
    actions = createActions(stateRef);
  });

  it('editing the body below the title line does not rewrite the terminal store', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    const before = useTerminalStore.getState().terminals;
    actions.updateContent('origin', 'Bound origin\nadded body line');
    actions.updateContent('origin', 'Bound origin\nadded body line\nanother');
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('renaming to a value whose extracted title equals the current title is a no-op', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    const before = useTerminalStore.getState().terminals;
    actions.updateContent('origin', '\n\n  Bound origin  \nwith body');
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('repeated identical renames produce no extra terminal-store writes', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', 'New title');
    const afterFirst = useTerminalStore.getState().terminals;
    actions.updateContent('origin', 'New title');
    actions.updateContent('origin', 'New title');
    const afterRepeats = useTerminalStore.getState().terminals;

    expect(afterRepeats).toBe(afterFirst);
    expect(titleOf('term-1')).toBe('New title');
  });
});

describe('terminal title syncs with bound root rename — boundary inputs', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildState() };
    actions = createActions(stateRef);
  });

  it('no terminals at all — rename is safe and tree state still updates', () => {
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: FILE_PATH,
      fileStates: { [FILE_PATH]: { terminals: [], activeTerminalId: null } },
    });

    expect(() => actions.updateContent('origin', 'Renamed origin')).not.toThrow();
    expect(stateRef.current.nodes['origin'].content).toBe('Renamed origin');
  });

  it('updating a node that no longer exists is a safe no-op for the terminal store', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    const before = useTerminalStore.getState().terminals;
    actions.updateContent('ghost', 'Should not crash');
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound origin');
  });

  it('control characters in the renamed title are stripped, matching the bind-path extractor', () => {
    setTerminals([{ id: 'term-1', title: 'Bound origin', originNodeId: 'origin' }]);

    actions.updateContent('origin', 'Hello\u0007world');

    expect(titleOf('term-1')).toBe('Helloworld');
  });
});
