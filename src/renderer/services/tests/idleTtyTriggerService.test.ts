import { describe, it } from 'vitest';

describe('idleTtyTriggerService — paste decision', () => {
  it.todo('on prompt enqueue while session is in an active turn, does NOT paste (Stop hook will chain instead)');
  it.todo('on prompt enqueue while session is fully idle, writes the fixed trigger string to the bound terminal');
  it.todo('the trigger string is a fixed sentence instructing Claude to call next_instruction — it never includes prompt content');
  it.todo('on prompt enqueue with no terminal mapping for the session, logs and skips the paste (graceful)');
});

describe('idleTtyTriggerService — session activity tracking', () => {
  it.todo('SessionStart hook event moves the session into the active-turn state');
  it.todo('UserPromptSubmit hook event moves the session into the active-turn state');
  it.todo('Stop hook event (no chaining) moves the session into the idle state');
  it.todo('Stop hook event when the queue is non-empty does NOT mark the session idle — the chain keeps it active');
  it.todo('a session never seen before is treated as idle (paste on first enqueue)');
});

describe('idleTtyTriggerService — boundary inputs', () => {
  it.todo('rapid duplicate enqueues while idle paste the trigger once, not per enqueue (debounced)');
  it.todo('an enqueue for an unknown session id is logged and ignored — no paste');
  it.todo('terminal write failure is swallowed and logged — does not propagate to the queue listener');
});
