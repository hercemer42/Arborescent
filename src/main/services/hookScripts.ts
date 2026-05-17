import { ARBORESCENT_MARKER_REGEX } from '../../shared/utils/arborescentMarker';

const HOOK_REGISTER_BINDING_FN = `
function postRegisterBinding(port, token, sessionId, nodeUuid, source) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'register-binding',
      node_uuid: nodeUuid,
      source: source,
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: Number(port),
      method: 'POST',
      path: '/hook',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 2000,
    }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', (err) => {
      process.stderr.write('[arborescent hook] register failed: ' + err.message + '\\n');
      resolve();
    });
    req.on('timeout', () => {
      process.stderr.write('[arborescent hook] register timed out\\n');
      req.destroy();
      resolve();
    });
    req.write(body);
    req.end();
  });
}
`;

// Both hooks defensively short-circuit on TTY stdin and arm a watchdog timer so a
// misconfigured spawn (no piped JSON) cannot hang Claude Code's turn indefinitely.
const HOOK_BOOT_GUARDS = `
if (process.stdin.isTTY) process.exit(0);
setTimeout(() => process.exit(0), 5000);
`;

export const SESSION_START_HOOK_SCRIPT = `#!/usr/bin/env node
const http = require('node:http');
${HOOK_BOOT_GUARDS}
let stdinBuf = '';
process.stdin.on('data', (chunk) => { stdinBuf += chunk.toString(); });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(stdinBuf); } catch { /* ignore */ }

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
  const nodeUuid = process.env.ARBORESCENT_NODE_UUID || '';
  const port = process.env.ARBORESCENT_HOOK_PORT || '';
  const token = process.env.ARBORESCENT_AUTH_TOKEN || '';
  const source = typeof payload.source === 'string' ? payload.source : 'unknown';

  if (!sessionId) {
    process.exit(0);
  }

  emitSessionContext(sessionId).then(() => {
    if (nodeUuid && port && token) {
      return postRegisterBinding(port, token, sessionId, nodeUuid, source);
    }
  }).finally(() => process.exit(0));
});

function emitSessionContext(sessionId) {
  return new Promise((resolve) => {
    const directive =
      'You are connected to the Arborescent MCP server. Your Arborescent session_id is "' +
      sessionId +
      '". When calling any arborescent MCP tool (get_node, get_tree, list_contexts, and future tools), pass exactly this string as the session_id argument.';
    const response = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: directive,
      },
    };
    process.stdout.write(JSON.stringify(response), () => resolve());
  });
}
${HOOK_REGISTER_BINDING_FN}`;

export const USER_PROMPT_SUBMIT_HOOK_SCRIPT = `#!/usr/bin/env node
const http = require('node:http');
${HOOK_BOOT_GUARDS}
const HOOK_MARKER_REGEX = /${ARBORESCENT_MARKER_REGEX.source}/;

let stdinBuf = '';
process.stdin.on('data', (chunk) => { stdinBuf += chunk.toString(); });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(stdinBuf); } catch { /* ignore */ }

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';

  const match = prompt.match(HOOK_MARKER_REGEX);
  if (!match) {
    process.exit(0);
  }

  const nodeUuid = match[1];
  const stripped = prompt.slice(match[0].length);
  const port = process.env.ARBORESCENT_HOOK_PORT || '';
  const token = process.env.ARBORESCENT_AUTH_TOKEN || '';

  // process.stdout is non-blocking on a pipe; emitting the stripped prompt and then
  // calling process.exit(0) synchronously can drop the JSON before flush, which would
  // leak the marker into Claude's conversation. Always wait for the write callback.
  emitOutput(stripped).then(() => {
    if (sessionId && port && token) {
      return postRegisterBinding(port, token, sessionId, nodeUuid, 'user-prompt-submit');
    }
  }).finally(() => process.exit(0));
});

function emitOutput(updatedPrompt) {
  return new Promise((resolve) => {
    const response = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        updatedPrompt,
      },
    };
    process.stdout.write(JSON.stringify(response), () => resolve());
  });
}
${HOOK_REGISTER_BINDING_FN}`;
