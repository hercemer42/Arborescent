import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createIdleTtyTriggerService, IDLE_TTY_TRIGGER_STRING } from '../idleTtyTriggerService';

type EnqueueListener = (sessionId: string) => void;
type HookListener = (event: { session_id: string; hook_event_name: string }) => void;

function makeHarness() {
  const enqueueListeners = new Set<EnqueueListener>();
  const hookListeners = new Set<HookListener>();
  const writeTerminal = vi.fn<(terminalId: string, data: string) => Promise<void>>(async () => {});
  const lookupTerminalForSession = vi.fn<(sessionId: string) => string | null>(() => null);
  const probeQueue = vi.fn<(sessionId: string) => Promise<{ hasItems: boolean }>>(async () => ({ hasItems: false }));
  return {
    enqueueListeners,
    hookListeners,
    writeTerminal,
    lookupTerminalForSession,
    probeQueue,
    deps: {
      onPromptEnqueued: (cb: EnqueueListener) => {
        enqueueListeners.add(cb);
        return () => enqueueListeners.delete(cb);
      },
      onHookEvent: (cb: HookListener) => {
        hookListeners.add(cb);
        return () => hookListeners.delete(cb);
      },
      writeTerminal,
      lookupTerminalForSession,
      probeQueue,
    },
    emitEnqueue(sessionId: string) {
      for (const l of enqueueListeners) l(sessionId);
    },
    emitHook(payload: { session_id: string; hook_event_name: string }) {
      for (const l of hookListeners) l(payload);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('idleTtyTriggerService — paste decision', () => {
  it('on prompt enqueue while session is in an active turn, does NOT paste (Stop hook will chain instead)', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitHook({ session_id: 'sess-1', hook_event_name: 'UserPromptSubmit' });
    h.emitEnqueue('sess-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).not.toHaveBeenCalled();
  });

  it('on prompt enqueue while session is fully idle, writes the fixed trigger string to the bound terminal', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitEnqueue('sess-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).toHaveBeenCalledTimes(1);
    expect(h.writeTerminal).toHaveBeenCalledWith('term-1', IDLE_TTY_TRIGGER_STRING);
  });

  it('the trigger string is a fixed sentence instructing Claude to call next_instruction — it never includes prompt content', () => {
    expect(IDLE_TTY_TRIGGER_STRING).toMatch(/next_instruction/);
    expect(IDLE_TTY_TRIGGER_STRING).not.toMatch(/\bprompt\s*content\b/i);
    expect(IDLE_TTY_TRIGGER_STRING.length).toBeLessThan(500);
  });

  it('on prompt enqueue with no terminal mapping for the session, logs and skips the paste (graceful)', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue(null);
    createIdleTtyTriggerService(h.deps);
    h.emitEnqueue('sess-unknown');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).not.toHaveBeenCalled();
  });
});

describe('idleTtyTriggerService — session activity tracking', () => {
  it('SessionStart hook event moves the session into the active-turn state', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitHook({ session_id: 'sess-1', hook_event_name: 'SessionStart' });
    h.emitEnqueue('sess-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).not.toHaveBeenCalled();
  });

  it('UserPromptSubmit hook event moves the session into the active-turn state', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitHook({ session_id: 'sess-1', hook_event_name: 'UserPromptSubmit' });
    h.emitEnqueue('sess-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).not.toHaveBeenCalled();
  });

  it('Stop hook event moves the session into the idle state (subsequent enqueues paste)', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitHook({ session_id: 'sess-1', hook_event_name: 'SessionStart' });
    h.emitHook({ session_id: 'sess-1', hook_event_name: 'Stop' });
    h.emitEnqueue('sess-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).toHaveBeenCalledTimes(1);
  });

  it('a session never seen before is treated as idle (paste on first enqueue)', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitEnqueue('first-time-sess');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).toHaveBeenCalledTimes(1);
  });
});

describe('idleTtyTriggerService — boundary inputs', () => {
  it('terminal write failure is swallowed and logged — does not propagate to the queue listener', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    h.writeTerminal.mockImplementation(async () => {
      throw new Error('terminal gone');
    });
    createIdleTtyTriggerService(h.deps);
    expect(() => h.emitEnqueue('sess-1')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).toHaveBeenCalled();
  });

  it('an enqueue with an empty session_id is logged and ignored — no paste', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    createIdleTtyTriggerService(h.deps);
    h.emitEnqueue('');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).not.toHaveBeenCalled();
  });

  it('dispose() detaches both listeners — later enqueues and hook events have no effect', async () => {
    const h = makeHarness();
    h.lookupTerminalForSession.mockReturnValue('term-1');
    const service = createIdleTtyTriggerService(h.deps);
    service.dispose();
    h.emitEnqueue('sess-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.writeTerminal).not.toHaveBeenCalled();
    expect(h.enqueueListeners.size).toBe(0);
    expect(h.hookListeners.size).toBe(0);
  });
});
