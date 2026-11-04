'use strict';

// A pr-radar plugin for Claude sessions run in Arborescent terminals, used by the session button on a
// pr-radar card. List this file in pr-radar's PR_RADAR_PLUGINS.
//
// - focus: a session running in an Arborescent terminal is brought forward, its file and tab shown.
// - open: a session that is not running reopens in Arborescent, in the tab it last ran in or a new
//   one, Arborescent launched first when it is not running. Every session is claimed: load this only
//   if Arborescent is where you run Claude.
//
// Arborescent writes its hook server's port and token to ~/.arborescent/hook.json when it starts;
// this sends that server a `Focus` or `Resume` event naming the session.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const ENDPOINT = path.join(os.homedir(), '.arborescent', 'hook.json');
const IN_ARBORESCENT = /\/Arborescent\.app\//;
const LAUNCH_WAIT_MS = 20_000;
// ponytail: a fixed grace for the window to load its files before the event lands, since the hook
// server answers before the renderer listens; replace with a readiness flag in hook.json if it bites.
const RENDERER_GRACE_MS = 4_000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function liveEndpoint() {
  try {
    const endpoint = JSON.parse(fs.readFileSync(ENDPOINT, 'utf8'));
    process.kill(endpoint.pid, 0);
    return endpoint;
  } catch {
    return null;
  }
}

async function launched() {
  await new Promise((resolve, reject) => execFile('open', ['-a', 'Arborescent'], error => (error ? reject(error) : resolve())));
  for (const deadline = Date.now() + LAUNCH_WAIT_MS; Date.now() < deadline; await sleep(300)) {
    const endpoint = liveEndpoint();
    if (endpoint) {
      await sleep(RENDERER_GRACE_MS);
      return endpoint;
    }
  }
  throw new Error(`Arborescent did not publish its hook server within ${LAUNCH_WAIT_MS / 1000}s of launching`);
}

async function send(endpoint, event) {
  const response = await fetch(`http://127.0.0.1:${endpoint.port}/hook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${endpoint.token}` },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Arborescent refused the ${event.hook_event_name} request: HTTP ${response.status}`);
}

module.exports = {
  name: 'arborescent-focus',

  async focus(session) {
    if (!session.ancestors.some(command => IN_ARBORESCENT.test(command))) return false;
    const endpoint = liveEndpoint();
    if (!endpoint) throw new Error(`Arborescent has not published its hook server at ${ENDPOINT}: restart it on a version that does`);
    await send(endpoint, { session_id: session.sessionId, hook_event_name: 'Focus' });
    return true;
  },

  async open(session) {
    const endpoint = liveEndpoint() ?? (await launched());
    await send(endpoint, { session_id: session.sessionId, hook_event_name: 'Resume', cwd: session.cwd });
    return true;
  },
};
