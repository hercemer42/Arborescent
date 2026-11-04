'use strict';

// A pr-radar plugin that brings forward a Claude session running in an Arborescent terminal, from
// the session button on a pr-radar card. List this file in pr-radar's PR_RADAR_PLUGINS.
//
// Arborescent writes its hook server's port and token to ~/.arborescent/hook.json when it starts;
// this sends that server a `Focus` event naming the session, and Arborescent shows the file and the
// terminal tab holding it.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ENDPOINT = path.join(os.homedir(), '.arborescent', 'hook.json');
const IN_ARBORESCENT = /\/Arborescent\.app\//;

module.exports = {
  name: 'arborescent-focus',

  async focus(session) {
    if (!session.ancestors.some(command => IN_ARBORESCENT.test(command))) return false;
    let endpoint;
    try {
      endpoint = JSON.parse(fs.readFileSync(ENDPOINT, 'utf8'));
    } catch {
      throw new Error(`Arborescent has not published its hook server at ${ENDPOINT}: restart it on a version that does`);
    }
    const response = await fetch(`http://127.0.0.1:${endpoint.port}/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${endpoint.token}` },
      body: JSON.stringify({ session_id: session.sessionId, hook_event_name: 'Focus' }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Arborescent refused the focus request: HTTP ${response.status}`);
    return true;
  },
};
