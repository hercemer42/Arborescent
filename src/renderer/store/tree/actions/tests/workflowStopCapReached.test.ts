import { describe, it, expect, vi, beforeEach } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

const notifyMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/logger', () => ({
  logger: loggerMocks,
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => toastMocks },
}));

vi.mock('../../../../services/workflowNotification', () => ({
  notifyWorkflowEvent: notifyMock,
}));

import { createHookEventHandler } from '../workflowHookEventHandler';

type DepArgs = Parameters<typeof createHookEventHandler>[0];

function makeDeps(): DepArgs {
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
  };
}

describe('handleHookEvent — stop-cap-reached surfacing', () => {
  beforeEach(() => {
    toastMocks.addToast.mockClear();
    notifyMock.mockClear();
    Object.values(loggerMocks).forEach((m) => m.mockClear());
  });

  it('raises a persistent warning toast on stop-cap-reached', () => {
    const handler = createHookEventHandler(makeDeps());

    handler({
      session_id: 'sess-1',
      hook_event_name: 'stop-cap-reached',
      message: JSON.stringify({ iterations: 8, cap: 8 }),
    });

    expect(toastMocks.addToast).toHaveBeenCalledTimes(1);
    const [text, level, options] = toastMocks.addToast.mock.calls[0];
    expect(level).toBe('warning');
    expect(String(text)).toMatch(/8\/8/);
    expect((options as { persistent?: boolean }).persistent).toBe(true);
  });

  it('also emits a workflowNotification alert so the OS-level notification fires', () => {
    const handler = createHookEventHandler(makeDeps());

    handler({
      session_id: 'sess-1',
      hook_event_name: 'stop-cap-reached',
      message: JSON.stringify({ iterations: 8, cap: 8 }),
    });

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0]).toBe('alert');
  });

  it('falls back to a generic message when the payload is malformed', () => {
    const handler = createHookEventHandler(makeDeps());

    handler({
      session_id: 'sess-1',
      hook_event_name: 'stop-cap-reached',
      message: 'not-json',
    });

    expect(toastMocks.addToast).toHaveBeenCalledTimes(1);
    expect(String(toastMocks.addToast.mock.calls[0][0])).toMatch(/chain limit/i);
  });

  it('surfaces the cap-reached toast even when no terminal is mapped for the session', () => {
    const handler = createHookEventHandler(makeDeps());

    handler({
      session_id: 'unknown-session',
      hook_event_name: 'stop-cap-reached',
      message: JSON.stringify({ iterations: 8, cap: 8 }),
    });

    expect(toastMocks.addToast).toHaveBeenCalledTimes(1);
    const dropWarnings = loggerMocks.warn.mock.calls.filter((c) =>
      /dropped/i.test(String(c[0])),
    );
    expect(dropWarnings).toHaveLength(0);
  });
});
