import { describe, it, expect, vi, beforeEach } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: loggerMocks,
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('../../../../services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

import { createHookEventHandler } from '../workflowHookEventHandler';

type DepArgs = Parameters<typeof createHookEventHandler>[0];

function makeDeps(overrides: Partial<DepArgs> = {}): DepArgs {
  return {
    get: () => ({
      nodes: {},
      ancestorRegistry: {},
      workflowExecutionStates: {},
      workflowSessionMap: {},
    }),
    set: vi.fn(),
    findRunningNodeOnTerminal: vi.fn(() => null),
    clearStepTimeout: vi.fn(),
    consumePendingAck: vi.fn(),
    advanceNode: vi.fn(),
    completeWorkflow: vi.fn(),
    stopWorkflow: vi.fn(),
    ...overrides,
  };
}

describe('handleHookEvent drop-reason logging', () => {
  beforeEach(() => {
    Object.values(loggerMocks).forEach((m) => m.mockClear());
  });

  describe('no terminal mapped', () => {
    it('emits a warn naming the dropped event and missing session mapping', () => {
      const handler = createHookEventHandler(makeDeps());

      handler({ session_id: 'unknown-session', hook_event_name: 'Stop' });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes('Stop') && /no terminal mapped/i.test(m))).toBe(true);
    });

    it('includes the session_id on the drop-reason warning so it can be greppped', () => {
      const handler = createHookEventHandler(makeDeps());

      handler({ session_id: 'session-xyz', hook_event_name: 'Stop' });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes('session-xyz'))).toBe(true);
    });
  });

  describe('no running node on terminal', () => {
    it('emits a warn naming the dropped event and terminal id', () => {
      const handler = createHookEventHandler(
        makeDeps({
          get: () => ({
            nodes: {},
            ancestorRegistry: {},
            workflowExecutionStates: {},
            workflowSessionMap: { 'session-1': 'terminal-7' },
          }),
          findRunningNodeOnTerminal: vi.fn(() => null),
        })
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes('Stop') && /no running node/i.test(m))).toBe(true);
    });

    it('includes the terminal_id on the drop-reason warning', () => {
      const handler = createHookEventHandler(
        makeDeps({
          get: () => ({
            nodes: {},
            ancestorRegistry: {},
            workflowExecutionStates: {},
            workflowSessionMap: { 'session-1': 'terminal-7' },
          }),
          findRunningNodeOnTerminal: vi.fn(() => null),
        })
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      const messages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes('terminal-7'))).toBe(true);
    });
  });

  describe('node_id tag on resolved events', () => {
    it('passes nodeId in the meta arg once the event maps to a running node', () => {
      const handler = createHookEventHandler(
        makeDeps({
          get: () => ({
            nodes: {
              'node-a': {
                id: 'node-a',
                content: 'root',
                parentId: null,
                children: [],
                metadata: { isWorkflow: true },
              } as never,
            },
            ancestorRegistry: { 'node-a': [] },
            workflowExecutionStates: {
              'node-a': { state: 'running', terminalTabId: 'terminal-1' } as never,
            },
            workflowSessionMap: { 'session-1': 'terminal-1' },
          }),
          findRunningNodeOnTerminal: vi.fn(() => 'node-a'),
        })
      );

      handler({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });

      const infoCallsWithNodeMeta = loggerMocks.info.mock.calls.filter(
        (call) => call[2] && (call[2] as { nodeId?: string }).nodeId === 'node-a',
      );
      expect(infoCallsWithNodeMeta.length).toBeGreaterThan(0);
    });

    it('omits nodeId meta on the unresolved (drop-reason) warnings', () => {
      const handler = createHookEventHandler(makeDeps());

      handler({ session_id: 'unknown', hook_event_name: 'Stop' });

      const warnCallsWithMeta = loggerMocks.warn.mock.calls.filter((call) => call[2] !== undefined);
      expect(warnCallsWithMeta).toHaveLength(0);
    });
  });

  describe('successful resolution', () => {
    it('does not emit a drop-reason warning when the event resolves to a running node', () => {
      const handler = createHookEventHandler(
        makeDeps({
          get: () => ({
            nodes: {
              'node-a': {
                id: 'node-a',
                content: 'root',
                parentId: null,
                children: [],
                metadata: { isWorkflow: true },
              } as never,
            },
            ancestorRegistry: { 'node-a': [] },
            workflowExecutionStates: {
              'node-a': { state: 'running', terminalTabId: 'terminal-1' } as never,
            },
            workflowSessionMap: { 'session-1': 'terminal-1' },
          }),
          findRunningNodeOnTerminal: vi.fn(() => 'node-a'),
        })
      );

      handler({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });

      const dropMessages = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(dropMessages.some((m) => /dropped/i.test(m))).toBe(false);
    });
  });
});
