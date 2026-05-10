import { describe, it } from 'vitest';

describe('Send — capture-on-Send (sessionless source → terminal hosting a session)', () => {
  it.todo('capturing the target terminal\'s mapped sessionId onto the source node when the source has no sessionId');
  it.todo('does NOT auto-launch claude when the target already has a mapped session — sends prompt directly');
  it.todo('captures the same sessionId onto multiple nodes when each is sent in turn (multi-node-share)');
  it.todo('does not duplicate the registry entry when capturing onto the second node — single sessionRegistry entry per sessionId');
});

describe('Send — capture-on-Send (sessionless source → terminal hosting an unmapped session)', () => {
  it.todo('captures the unmapped sessionId onto the source node and adds it to workflowSessionMap');
  it.todo('writes registry.cwd from terminalGetCwd at the moment of capture');
});

describe('Send — sessionless source + fresh terminal triggers auto-launch', () => {
  it.todo('writes claude\\r and defers the prompt until SessionStart fires');
  it.todo('after SessionStart, the new sessionId is captured onto the source node');
  it.todo('after SessionStart, the new registry.cwd is written from terminalGetCwd');
});

describe('Send — sessionId X into terminal hosting same sessionId X', () => {
  it.todo('reattaches and sends — no modal, no block, no auto-launch');
});

describe('Send — sessionId X into terminal hosting sessionId Y mapped to another node (mismatch-block)', () => {
  it.todo('blocks with a toast — would steal another chain\'s session');
  it.todo('does not write to the terminal');
  it.todo('does not mutate either node\'s sessionId');
  it.todo('does not mutate workflowSessionMap');
});

describe('Send — sessionId X into terminal hosting unmapped session ("Are you sure?" modal)', () => {
  it.todo('surfaces a confirm modal naming the existing sessionId on the source node');
  it.todo('on confirm, replaces source node\'s sessionId with the captured target session and proceeds');
  it.todo('on cancel, makes no changes — sessionId stays, no prompt sent, registry untouched');
});

describe('Send — sessionId X into terminal with no Claude session ("Are you sure?" modal)', () => {
  it.todo('surfaces a confirm modal asking whether to start a new session here');
  it.todo('on confirm, replaces source node\'s sessionId, runs auto-launch, captures new session at SessionStart');
  it.todo('on cancel, no claude\\r is written, no registry mutation, no node mutation');
});

describe('Send — cwd block (rule 6) fires before any session-id rules', () => {
  it.todo('blocks with informational toast naming both directories when registry cwd differs from terminalGetCwd');
  it.todo('cwd block fires even when the same sessionId is mapped to the target terminal (would have been a reattach)');
  it.todo('cwd block fires even when the modal would have surfaced — modal is suppressed');
  it.todo('cwd block does not fire on sessionless sources — those capture target cwd at SessionStart');
  it.todo('does not write to the terminal under any cwd-block branch');
});

describe('Send — capture-on-Send concurrency', () => {
  it.todo('two consecutive sends to the same fresh terminal do not double-capture or double-launch');
});

describe('Send — error / failure states', () => {
  it.todo('cwd-fetch (terminalGetCwd) returning null/empty is treated as cwd-mismatch and surfaces the cwd-block toast');
  it.todo('terminalWrite rejecting after capture surfaces an error toast and does not leave a stale pending entry');
});

describe('Send — accessibility', () => {
  it.todo('the "Are you sure?" modal is keyboard-dismissible and ESC cancels');
  it.todo('the cwd-block toast carries an accessible label naming both paths');
});
