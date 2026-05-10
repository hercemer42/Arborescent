import { describe, it, expect } from 'vitest';
import {
  decideWorkflowStartRoute,
  type WorkflowStartRouteInput,
} from '../workflowStartRoute';

// PR1: routing inputs now use workflowSessionMap + sessionRegistry instead of
// stored sessionLiveness / sessionTabId / sessionWorkingDirectory on the node.

const baseInput: WorkflowStartRouteInput = {
  sessionId: undefined,
  workflowSessionMap: {},
  sessionRegistry: {},
  openTerminalIds: new Set(),
};

describe('decideWorkflowStartRoute', () => {
  describe('spawn-fresh — no sessionId', () => {
    it('returns spawn-fresh when the node has never recorded a session', () => {
      expect(decideWorkflowStartRoute(baseInput)).toEqual({ kind: 'spawn-fresh' });
    });

    it('treats an empty-string sessionId as no session — returns spawn-fresh', () => {
      expect(
        decideWorkflowStartRoute({ ...baseInput, sessionId: '' }),
      ).toEqual({ kind: 'spawn-fresh' });
    });

    it('returns spawn-fresh when openTerminalIds is empty and there is no session', () => {
      expect(decideWorkflowStartRoute(baseInput)).toEqual({ kind: 'spawn-fresh' });
    });
  });

  describe('focus-existing-tab — session is in workflowSessionMap AND terminal is open', () => {
    it('returns focus-existing-tab when sessionId is mapped and the mapped terminal is open', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: { 'sess-1': 'term-1' },
        openTerminalIds: new Set(['term-1', 'term-2']),
      });
      expect(route).toEqual({ kind: 'focus-existing-tab', terminalId: 'term-1' });
    });

    it('uses the mapped terminal, not the passed terminalId — auto-route to session host', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: { 'sess-1': 'term-2' },
        openTerminalIds: new Set(['term-1', 'term-2']),
      });
      expect(route).toEqual({ kind: 'focus-existing-tab', terminalId: 'term-2' });
    });

    it('returns focus-existing-tab even when multiple sessions are mapped', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-2',
        workflowSessionMap: { 'sess-1': 'term-1', 'sess-2': 'term-2' },
        openTerminalIds: new Set(['term-1', 'term-2', 'term-3']),
      });
      expect(route).toEqual({ kind: 'focus-existing-tab', terminalId: 'term-2' });
    });
  });

  describe('resume-in-new-tab — sessionId set but mapped terminal is not open', () => {
    it('returns resume-in-new-tab when the mapped terminal is no longer open', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: { 'sess-1': 'term-closed' },
        sessionRegistry: { 'sess-1': { cwd: '/Users/me/project' } },
        openTerminalIds: new Set(['term-other']),
      });
      expect(route).toEqual({
        kind: 'resume-in-new-tab',
        sessionId: 'sess-1',
        cwd: '/Users/me/project',
      });
    });

    it('returns resume-in-new-tab when sessionId is set but not in workflowSessionMap', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: {},
        sessionRegistry: { 'sess-1': { cwd: '/project' } },
        openTerminalIds: new Set(['term-1']),
      });
      expect(route).toEqual({
        kind: 'resume-in-new-tab',
        sessionId: 'sess-1',
        cwd: '/project',
      });
    });

    it('returns resume-in-new-tab with undefined cwd when sessionRegistry has no entry', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: {},
        sessionRegistry: {},
        openTerminalIds: new Set(),
      });
      expect(route).toEqual({
        kind: 'resume-in-new-tab',
        sessionId: 'sess-1',
        cwd: undefined,
      });
    });
  });

  describe('priority order', () => {
    it('prefers focus-existing-tab over resume-in-new-tab when session is mapped and terminal open', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: { 'sess-1': 'term-1' },
        sessionRegistry: { 'sess-1': { cwd: '/project' } },
        openTerminalIds: new Set(['term-1']),
      });
      expect(route.kind).toBe('focus-existing-tab');
    });

    it('falls through to resume-in-new-tab when mapped terminal is gone', () => {
      const route = decideWorkflowStartRoute({
        ...baseInput,
        sessionId: 'sess-1',
        workflowSessionMap: { 'sess-1': 'term-gone' },
        sessionRegistry: { 'sess-1': { cwd: '/project' } },
        openTerminalIds: new Set(['term-other']),
      });
      expect(route.kind).toBe('resume-in-new-tab');
    });
  });
});
