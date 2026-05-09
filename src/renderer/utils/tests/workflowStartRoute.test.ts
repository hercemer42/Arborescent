import { describe, it, expect } from 'vitest';
import {
  decideWorkflowStartRoute,
  type WorkflowStartRouteInput,
} from '../workflowStartRoute';

const baseInput: WorkflowStartRouteInput = {
  sessionId: undefined,
  sessionLiveness: undefined,
  sessionTabId: undefined,
  sessionWorkingDirectory: undefined,
  openTerminalIds: new Set(),
};

describe('decideWorkflowStartRoute', () => {
  describe('spawn-fresh — no recorded session (rule 7)', () => {
    it('returns spawn-fresh when the node has never recorded a session', () => {
      expect(decideWorkflowStartRoute(baseInput)).toEqual({ kind: 'spawn-fresh' });
    });

    it('returns spawn-fresh when sessionId is set but sessionLiveness is lost', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'lost',
        sessionTabId: 'term-1',
      });
      expect(route).toEqual({ kind: 'spawn-fresh' });
    });

    it('returns spawn-fresh when sessionStarting was orphaned (no sessionId)', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: undefined,
        sessionLiveness: undefined,
        sessionTabId: 'term-1',
      });
      expect(route).toEqual({ kind: 'spawn-fresh' });
    });
  });

  describe('focus-existing-tab — session alive AND tab still open (rule 8a + rule 9)', () => {
    it('returns focus-existing-tab when sessionTabId is in openTerminalIds and liveness is alive-attached', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'alive-attached',
        sessionTabId: 'term-1',
        openTerminalIds: new Set(['term-1', 'term-2']),
      });
      expect(route).toEqual({ kind: 'focus-existing-tab', terminalId: 'term-1' });
    });

    it('returns focus-existing-tab even when other terminals exist — never spawns a duplicate for the same session id', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'alive-attached',
        sessionTabId: 'term-2',
        openTerminalIds: new Set(['term-1', 'term-2', 'term-3']),
      });
      expect(route).toEqual({ kind: 'focus-existing-tab', terminalId: 'term-2' });
    });
  });

  describe('resume-in-new-tab — session resumable, tab no longer open (rule 8b)', () => {
    it('returns resume-in-new-tab when liveness is alive-detached and there is no tab to focus', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'alive-detached',
        sessionTabId: undefined,
        sessionWorkingDirectory: '/Users/me/project',
        openTerminalIds: new Set(['term-other']),
      });
      expect(route).toEqual({
        kind: 'resume-in-new-tab',
        sessionId: 'sess-1',
        cwd: '/Users/me/project',
      });
    });

    it('returns resume-in-new-tab when the recorded sessionTabId no longer exists in openTerminalIds (alive-attached on disk after a restart)', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'alive-attached',
        sessionTabId: 'term-1',
        sessionWorkingDirectory: '/Users/me/project',
        openTerminalIds: new Set(['term-2']),
      });
      expect(route).toEqual({
        kind: 'resume-in-new-tab',
        sessionId: 'sess-1',
        cwd: '/Users/me/project',
      });
    });

    it('returns resume-in-new-tab with cwd undefined when no working directory is recorded', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'alive-detached',
        sessionTabId: undefined,
        sessionWorkingDirectory: undefined,
        openTerminalIds: new Set(),
      });
      expect(route).toEqual({
        kind: 'resume-in-new-tab',
        sessionId: 'sess-1',
        cwd: undefined,
      });
    });
  });

  describe('boundary and error inputs', () => {
    it('returns spawn-fresh when openTerminalIds is empty and there is no session', () => {
      expect(decideWorkflowStartRoute(baseInput)).toEqual({ kind: 'spawn-fresh' });
    });

    it('treats the empty string as a missing sessionId — returns spawn-fresh', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: '',
        sessionLiveness: 'alive-detached',
      });
      expect(route).toEqual({ kind: 'spawn-fresh' });
    });
  });

  describe('rule 8 priority order is checked top-down', () => {
    it('prefers focus-existing-tab over resume-in-new-tab when both could apply', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'alive-attached',
        sessionTabId: 'term-1',
        sessionWorkingDirectory: '/Users/me/project',
        openTerminalIds: new Set(['term-1']),
      });
      expect(route.kind).toBe('focus-existing-tab');
    });

    it('prefers spawn-fresh over resume-in-new-tab when liveness is lost, regardless of recorded sessionId or cwd', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        sessionLiveness: 'lost',
        sessionWorkingDirectory: '/Users/me/project',
        openTerminalIds: new Set(),
      });
      expect(route.kind).toBe('spawn-fresh');
    });
  });
});
