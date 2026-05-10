import { describe, it } from 'vitest';

describe('decideWorkflowStartRoute — reattach', () => {
  it.todo('returns "reattach" with the mapped terminalId when the workflow\'s sessionId is alive in some terminal');
  it.todo('reattach beats remap-warn — when session is alive, target terminal\'s state is irrelevant');
  it.todo('reattach payload carries the host terminalId, not the targetTerminalId the user clicked from');
});

describe('decideWorkflowStartRoute — spawn-fresh', () => {
  it.todo('returns "spawn-fresh" when the source node has no sessionId');
  it.todo('treats empty-string sessionId as no session — returns spawn-fresh');
  it.todo('spawn-fresh skips the cwd check (no recorded cwd to compare against)');
});

describe('decideWorkflowStartRoute — remap-warn', () => {
  it.todo('returns "remap-warn" when sessionId is set but the target terminal hosts no session at all');
  it.todo('returns "remap-warn" when sessionId is set and the target terminal hosts an unmapped session (not in workflowSessionMap)');
  it.todo('remap-warn payload carries the existing sessionId so the modal can name it');
});

describe('decideWorkflowStartRoute — block (cross-user-story)', () => {
  it.todo('returns "block" with reason "cross-user-story" when target terminal hosts a session belonging to a different isWorkflow=true ancestor');
  it.todo('returns "block" when target terminal hosts a session that any other node owns (for non-workflow source nodes)');
  it.todo('does NOT return "block" when target terminal hosts a session that belongs to the same user story (same isWorkflow ancestor)');
});

describe('decideWorkflowStartRoute — block (cwd mismatch)', () => {
  it.todo('returns "block" with reason "cwd-mismatch" when sessionId is set, registry cwd differs from targetTerminalCwd');
  it.todo('cwd block fires before remap-warn — even if session-id rules would otherwise produce a remap');
  it.todo('cwd block fires before cross-user-story block — cwd is the first gate');
  it.todo('skips cwd check when sessionId is unset (sessionless source — capture populates registry at SessionStart)');
  it.todo('treats empty/null targetTerminalCwd as cwd-mismatch (helper deferral)');
});

describe('decideWorkflowStartRoute — resume-in-new-tab path is owned by Resume session', () => {
  it.todo('does NOT return "resume-in-new-tab" — that path is owned by Resume session, not by Start workflow');
  it.todo('the Resume-in-new-tab logic lives in workflowSessionResume');
});

describe('decideWorkflowStartRoute — output kind is exhaustive', () => {
  it.todo('every input combination produces exactly one of: reattach | spawn-fresh | remap-warn | block');
});
