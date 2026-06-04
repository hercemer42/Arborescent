import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createClaudeLaunchManager } from '../workflowClaudeLaunch';

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockTerminalWrite } = vi.hoisted(() => ({
  mockTerminalWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('window', {
  electron: { terminalWrite: mockTerminalWrite },
});

describe('createClaudeLaunchManager', () => {
  type State = { workflowSessionMap: Record<string, string> };

  let state: State;
  let mockSendPrompt: ReturnType<typeof vi.fn>;
  let manager: ReturnType<typeof createClaudeLaunchManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalWrite.mockClear();
    mockTerminalWrite.mockResolvedValue(undefined);
    state = { workflowSessionMap: {} };
    mockSendPrompt = vi.fn();
    manager = createClaudeLaunchManager({
      get: () => state,
      sendPrompt: mockSendPrompt,
    });
  });

  describe('launchIfNeededThenSend — no entry in workflowSessionMap', () => {
    it('writes "claude\\r" to the target terminal', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      expect(mockTerminalWrite).toHaveBeenCalledWith('terminal-1', 'claude\r');
    });

    it('does NOT call sendPrompt synchronously — the prompt is deferred until SessionStart', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });

    it('registers a pending entry that onSessionStartConfirmed can pick up', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).toHaveBeenCalledWith('task-a', 'terminal-1', undefined);
    });

    it('writes "claude\\r" only once even if the same call is repeated synchronously');
  });

  describe('launchIfNeededThenSend — existing entry in workflowSessionMap', () => {
    beforeEach(() => {
      state.workflowSessionMap = { 'session-existing': 'terminal-1' };
    });

    it('does NOT write "claude\\r" when the terminal already hosts a session', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      const claudeWrites = mockTerminalWrite.mock.calls.filter(
        ([, payload]) => payload === 'claude\r',
      );
      expect(claudeWrites).toHaveLength(0);
    });

    it('calls sendPrompt directly (no defer)', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      expect(mockSendPrompt).toHaveBeenCalledWith('task-a', 'terminal-1', undefined);
    });

    it('does not register a pending entry — onSessionStartConfirmed for this terminal is a no-op', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      mockSendPrompt.mockClear();
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });
  });

  describe('onSessionStartConfirmed', () => {
    it('fires the deferred prompt when a pending entry exists for the terminal', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).toHaveBeenCalledWith('task-a', 'terminal-1', undefined);
    });

    it('removes the pending entry after firing — a second call is a no-op', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      mockSendPrompt.mockClear();
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });

    it('does NOT fire prompts for a different terminal', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      manager.launchIfNeededThenSend('task-b', 'terminal-2');
      mockSendPrompt.mockClear();

      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).toHaveBeenCalledTimes(1);
      expect(mockSendPrompt).toHaveBeenCalledWith('task-a', 'terminal-1', undefined);
    });

    it('is a no-op when no pending entry exists for the terminal', () => {
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });

    it.todo('uses the runningNodeId argument when the pending nodeId differs (capture-on-Send carry-through)');
  });

  describe('clearPending', () => {
    it('removes the pending entry for the given nodeId so subsequent SessionStart does not fire a prompt', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      manager.clearPending('task-a');
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });

    it('is a no-op when no pending entry exists for the nodeId', () => {
      expect(() => manager.clearPending('task-a')).not.toThrow();
    });

    it('only clears the matching nodeId — other pending entries survive', () => {
      manager.launchIfNeededThenSend('task-a', 'terminal-1');
      manager.launchIfNeededThenSend('task-b', 'terminal-2');
      manager.clearPending('task-a');

      manager.onSessionStartConfirmed('terminal-2', 'task-b');
      expect(mockSendPrompt).toHaveBeenCalledWith('task-b', 'terminal-2', undefined);
      expect(mockSendPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling — terminalWrite rejects', () => {
    it.todo('logs the error and does NOT register a pending entry when claude\\r fails to write');
    it.todo('does not silently leak a pending entry that would never be confirmed');
  });

  describe('concurrent launches on the same terminal', () => {
    it.todo('handles a second launchIfNeededThenSend on the same terminal before SessionStart arrives');
  });

  describe('boundary inputs', () => {
    it.todo('rejects empty terminalId without writing claude or registering pending');
    it.todo('rejects empty nodeId without writing claude or registering pending');
  });

  // Resume-prompt readiness fix: the resume path already writes
  // "claude --resume <id>", so it needs a deferral that registers a pending send
  // WITHOUT writing "claude\r" itself, fired by the same onSessionStartConfirmed path.
  describe('no-write deferral — resume path', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('registers a pending send WITHOUT writing "claude\\r" (claude --resume was already issued by the resume path)', () => {
      manager.deferSendUntilSessionStart('task-a', 'terminal-1');
      expect(mockTerminalWrite).not.toHaveBeenCalled();
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });

    it('fires the deferred send when the resumed session\'s SessionStart arrives', () => {
      manager.deferSendUntilSessionStart('task-a', 'terminal-1');
      manager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).toHaveBeenCalledWith('task-a', 'terminal-1', undefined);
    });

    it('routes a resumed send through sendAfterResume (clear-aware), not the direct sendPrompt', () => {
      const sendAfterResume = vi.fn();
      const resumeManager = createClaudeLaunchManager({
        get: () => state,
        sendPrompt: mockSendPrompt,
        sendAfterResume,
      });
      resumeManager.deferSendUntilSessionStart('task-a', 'terminal-1', 'workflow-start');
      resumeManager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(sendAfterResume).toHaveBeenCalledWith('task-a', 'terminal-1', 'workflow-start');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });

    it('surfaces a bounded-timeout error and clears the pending entry if SessionStart never arrives', () => {
      const onResumeTimeout = vi.fn();
      const timeoutManager = createClaudeLaunchManager({
        get: () => state,
        sendPrompt: mockSendPrompt,
        onResumeTimeout,
      });
      timeoutManager.deferSendUntilSessionStart('task-a', 'terminal-1');
      vi.advanceTimersByTime(29000);
      expect(onResumeTimeout).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(onResumeTimeout).toHaveBeenCalledWith('task-a', 'terminal-1');
      timeoutManager.onSessionStartConfirmed('terminal-1', 'task-a');
      expect(mockSendPrompt).not.toHaveBeenCalled();
    });
  });
});
