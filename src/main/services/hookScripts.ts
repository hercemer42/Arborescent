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

// Hooks defensively short-circuit on TTY stdin and arm a watchdog timer so a
// misconfigured spawn (no piped JSON) cannot hang Claude Code's turn indefinitely.
// Watchdog sits above the Stop hook's worst-case sequential budget (12s submit +
// 3s peek = 15s) plus transcript I/O and stdout flush, so a slow-but-successful
// submit followed by a slow peek isn't killed mid-flight.
const HOOK_BOOT_GUARDS = `
if (process.stdin.isTTY) process.exit(0);
setTimeout(() => process.exit(0), 20000);
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

const HOOK_POST_SUBMIT_STEP_OUTPUT_FN = `
function postSubmitStepOutput(mcpPort, mcpToken, sessionId, content) {
  return new Promise((resolve) => {
    const rpcId = Date.now() + '-' + Math.floor(Math.random() * 1e6);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: rpcId,
      method: 'tools/call',
      params: {
        name: 'submit_step_output',
        arguments: { session_id: sessionId, content: content, origin: 'safety-net' },
      },
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: Number(mcpPort),
      method: 'POST',
      path: '/mcp',
      headers: {
        'Authorization': 'Bearer ' + mcpToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 12000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          process.stderr.write('[arborescent stop hook] submit returned HTTP ' + res.statusCode + '\\n');
        } else {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const parsed = JSON.parse(raw.split('\\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('') || raw);
            if (parsed && parsed.result && parsed.result.isError) {
              const text = parsed.result.content && parsed.result.content[0] && parsed.result.content[0].text;
              process.stderr.write('[arborescent stop hook] submit returned tool error: ' + (text || 'unknown') + '\\n');
            }
          } catch { /* unparseable response body — drop quietly */ }
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      process.stderr.write('[arborescent stop hook] submit failed: ' + err.message + '\\n');
      resolve();
    });
    req.on('timeout', () => {
      process.stderr.write('[arborescent stop hook] submit timed out\\n');
      req.destroy();
      resolve();
    });
    req.write(body);
    req.end();
  });
}
`;

const HOOK_READ_LAST_ASSISTANT_MESSAGE_FN = `
function readLastAssistantMessage(transcriptPath) {
  const fs = require('node:fs');
  let raw = '';
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch (err) {
    process.stderr.write('[arborescent stop hook] could not read transcript: ' + err.message + '\\n');
    return null;
  }
  const lines = raw.split('\\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || entry.type !== 'assistant') continue;
    // First assistant entry walking back is THIS turn's. Scanning past it
    // would surface prior-turn text (the transcript is append-only across turns).
    const message = entry.message;
    if (!message || !Array.isArray(message.content)) return null;
    const text = message.content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\\n');
    if (text.length === 0) return null;
    return text;
  }
  return null;
}
`;

const HOOK_PEEK_QUEUE_FN = `
function peekQueue(mcpPort, mcpToken, sessionId) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: Number(mcpPort),
      method: 'GET',
      path: '/peek-queue?session_id=' + encodeURIComponent(sessionId),
      headers: { 'Authorization': 'Bearer ' + mcpToken },
      timeout: 3000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve(parsed && typeof parsed.hasItems === 'boolean' ? parsed : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}
`;

const HOOK_POST_CAP_REACHED_FN = `
function postCapReached(hookPort, hookToken, sessionId, iterations, cap) {
  if (!hookPort || !hookToken) return Promise.resolve();
  return new Promise((resolve) => {
    const body = JSON.stringify({
      session_id: sessionId,
      hook_event_name: 'stop-cap-reached',
      message: JSON.stringify({ iterations, cap }),
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: Number(hookPort),
      method: 'POST',
      path: '/hook',
      headers: {
        'Authorization': 'Bearer ' + hookToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 2000,
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}
`;

const HOOK_ITERATION_COUNTER_FN = `
function iterationCounterPath(sessionId) {
  const os = require('node:os');
  const path = require('node:path');
  const safe = sessionId.replace(/[^a-zA-Z0-9-]/g, '_');
  return path.join(os.tmpdir(), 'arborescent-stop-' + safe + '.json');
}

function readIterationCount(sessionId) {
  const fs = require('node:fs');
  try {
    const raw = fs.readFileSync(iterationCounterPath(sessionId), 'utf8');
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed && parsed.count) ? parsed.count : 0;
  } catch { return 0; }
}

function writeIterationCount(sessionId, count) {
  const fs = require('node:fs');
  try { fs.writeFileSync(iterationCounterPath(sessionId), JSON.stringify({ count: count })); }
  catch (err) { process.stderr.write('[arborescent stop hook] could not persist counter: ' + err.message + '\\n'); }
}

function resetIterationCount(sessionId) {
  const fs = require('node:fs');
  try { fs.unlinkSync(iterationCounterPath(sessionId)); } catch { /* not present is fine */ }
}
`;

export const STOP_HOOK_SCRIPT = `#!/usr/bin/env node
const http = require('node:http');
${HOOK_BOOT_GUARDS}
const STOP_HOOK_CAP_DEFAULT = 8;

let stdinBuf = '';
process.stdin.on('data', (chunk) => { stdinBuf += chunk.toString(); });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(stdinBuf); } catch { /* ignore */ }

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
  const transcriptPath = typeof payload.transcript_path === 'string' ? payload.transcript_path : '';
  const mcpPort = process.env.ARBORESCENT_MCP_PORT || '';
  const mcpToken = process.env.ARBORESCENT_MCP_TOKEN || '';
  const hookPort = process.env.ARBORESCENT_HOOK_PORT || '';
  const hookToken = process.env.ARBORESCENT_AUTH_TOKEN || '';
  const cap = Number(process.env.ARBORESCENT_STOP_HOOK_CAP) > 0
    ? Number(process.env.ARBORESCENT_STOP_HOOK_CAP)
    : STOP_HOOK_CAP_DEFAULT;

  if (!sessionId || !mcpPort || !mcpToken) {
    process.exit(0);
  }

  runStopHook({ sessionId, transcriptPath, mcpPort, mcpToken, hookPort, hookToken, cap })
    .finally(() => process.exit(0));
});

async function runStopHook(ctx) {
  if (ctx.transcriptPath) {
    const assistantText = readLastAssistantMessage(ctx.transcriptPath);
    if (assistantText !== null) {
      await postSubmitStepOutput(ctx.mcpPort, ctx.mcpToken, ctx.sessionId, assistantText);
    }
  }

  const peek = await peekQueue(ctx.mcpPort, ctx.mcpToken, ctx.sessionId);
  if (!peek) {
    return;
  }
  if (!peek.hasItems) {
    resetIterationCount(ctx.sessionId);
    return;
  }

  const current = readIterationCount(ctx.sessionId);
  if (current >= ctx.cap) {
    resetIterationCount(ctx.sessionId);
    await postCapReached(ctx.hookPort, ctx.hookToken, ctx.sessionId, current, ctx.cap);
    return;
  }

  writeIterationCount(ctx.sessionId, current + 1);
  const decision = {
    decision: 'block',
    reason: 'Arborescent has a queued instruction for this session. Call the next_instruction MCP tool with your session_id to retrieve it before stopping.',
  };
  await new Promise((resolve) => process.stdout.write(JSON.stringify(decision), () => resolve()));
}
${HOOK_POST_SUBMIT_STEP_OUTPUT_FN}
${HOOK_READ_LAST_ASSISTANT_MESSAGE_FN}
${HOOK_PEEK_QUEUE_FN}
${HOOK_POST_CAP_REACHED_FN}
${HOOK_ITERATION_COUNTER_FN}`;
