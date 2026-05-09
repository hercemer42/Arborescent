import { describe, it } from 'vitest';

// PR1 — Session liveness probe.
// States: alive-attached / alive-detached / lost.
// Drives the "Resume session" menu gate and the "session lost" node indicator.
// Implementation is pending; titles below pin the contract.

describe('sessionLivenessProbe — happy path (PR1)', () => {
  it.todo('probe(sessionId) returns "alive-attached" when the session has a live PTY hosted by an open tab');
  it.todo('probe(sessionId) returns "alive-detached" when the underlying CLI process is alive but no tab hosts it');
  it.todo('probe(sessionId) returns "lost" when the CLI session id is unknown to the runtime');
});

describe('sessionLivenessProbe — distinguishes workflow status from session liveness (PR1)', () => {
  it.todo('a workflow marked stopped while the underlying session is still running probes as alive-detached, not lost');
  it.todo('a workflow marked running with a dead underlying session probes as lost (truth is the process, not workflow status)');
});

describe('sessionLivenessProbe — boundary / error states (PR1)', () => {
  it.todo('probe with empty or whitespace sessionId returns "lost" without calling the CLI');
  it.todo('probe with undefined sessionId returns "lost"');
  it.todo('probe surfaces "lost" when the CLI errors out — does not throw');
  it.todo('probe surfaces "lost" when the working directory recorded for the session no longer exists');
});

describe('sessionLivenessProbe — concurrent / repeated calls (PR1)', () => {
  it.todo('two parallel probes of the same session resolve to the same liveness without duplicate CLI invocations');
  it.todo('rapid repeated probes are debounced or deduplicated within a short window');
});

describe('sessionLivenessProbe — reconciliation hooks (PR1)', () => {
  it.todo('after probe returns "lost", the registry binding for that session is dropped');
  it.todo('after probe returns "alive-detached", the registry is not modified (state belongs to the node, not the registry)');
});
