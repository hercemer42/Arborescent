import { describe, it, expect, vi } from 'vitest';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getAllStoreEntries: vi.fn(() => []),
    getAllStores: vi.fn(() => []),
    getStoreForFile: vi.fn(),
  },
}));

function makeBaseGet() {
  return vi.fn(() => ({
    nodes: {},
    ancestorRegistry: {},
    workflowExecutionStates: {},
    workflowSessionMap: {},
    terminalNodeAssignments: {},
    sessionRegistry: {},
    currentFilePath: '/test.arbo',
    rootNodeId: 'root',
    activeNodeId: null,
    multiSelectedNodeIds: new Set(),
    decomposition: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as unknown as any;
}

function makeActions() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createWorkflowExecutionActions(makeBaseGet(), vi.fn() as any);
}

describe('workflowExecutionActions — feedbackCollaborations registry is gone', () => {
  it('does NOT expose findCollaborationByFeedbackFilePath on the actions object', () => {
    const actions = makeActions();
    expect(actions).not.toHaveProperty('findCollaborationByFeedbackFilePath');
  });

  it('does NOT expose registerManualCollaboration on the actions object', () => {
    const actions = makeActions();
    expect(actions).not.toHaveProperty('registerManualCollaboration');
  });

  it('does NOT expose registerAutonomousCollaboration on the actions object', () => {
    const actions = makeActions();
    expect(actions).not.toHaveProperty('registerAutonomousCollaboration');
  });

  it('does NOT expose cleanupAutonomousCollaboration on the actions object', () => {
    const actions = makeActions();
    expect(actions).not.toHaveProperty('cleanupAutonomousCollaboration');
  });

  it('does NOT expose unregisterCollaboration on the actions object', () => {
    const actions = makeActions();
    expect(actions).not.toHaveProperty('unregisterCollaboration');
  });
});
