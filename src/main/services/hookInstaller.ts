import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from './logger';
import {
  SESSION_START_HOOK_SCRIPT,
  USER_PROMPT_SUBMIT_HOOK_SCRIPT,
  STOP_HOOK_SCRIPT,
} from './hookScripts';

type HookDescriptor = {
  filename: string;
  script: string;
};

const HOOKS: Record<string, HookDescriptor> = {
  SessionStart: {
    filename: 'arborescent-session-start.mjs',
    script: SESSION_START_HOOK_SCRIPT,
  },
  UserPromptSubmit: {
    filename: 'arborescent-user-prompt-submit.mjs',
    script: USER_PROMPT_SUBMIT_HOOK_SCRIPT,
  },
  Stop: {
    filename: 'arborescent-stop.mjs',
    script: STOP_HOOK_SCRIPT,
  },
};

export type HookInstallPaths = {
  sessionStart: string;
  userPromptSubmit: string;
  stop: string;
};

export type HookInstallerDeps = {
  userDataPath: string;
  homePath?: string;
};

function resolveHookPaths(userDataPath: string): Record<string, string> {
  const hooksDir = path.join(userDataPath, 'hooks');
  const paths: Record<string, string> = {};
  for (const [event, descriptor] of Object.entries(HOOKS)) {
    paths[event] = path.join(hooksDir, descriptor.filename);
  }
  return paths;
}

export async function installHooks(deps: HookInstallerDeps): Promise<HookInstallPaths> {
  const hooksDir = path.join(deps.userDataPath, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });

  const hookPaths = resolveHookPaths(deps.userDataPath);
  for (const [event, descriptor] of Object.entries(HOOKS)) {
    const scriptPath = hookPaths[event];
    await fs.writeFile(scriptPath, descriptor.script, { mode: 0o755 });
    // writeFile's `mode` only applies when the file is created. On reinstall the file
    // already exists, so the mode is silently ignored — chmod explicitly guarantees +x.
    await fs.chmod(scriptPath, 0o755);
  }

  const homePath = deps.homePath ?? os.homedir();
  const settingsPath = path.join(homePath, '.claude', 'settings.json');
  await mergeSettings(settingsPath, hookPaths);

  logger.info('Arborescent hooks installed', 'HookInstaller');
  return {
    sessionStart: hookPaths.SessionStart,
    userPromptSubmit: hookPaths.UserPromptSubmit,
    stop: hookPaths.Stop,
  };
}

export async function uninstallHooks(deps: HookInstallerDeps): Promise<void> {
  const hookPaths = resolveHookPaths(deps.userDataPath);
  const homePath = deps.homePath ?? os.homedir();
  const settingsPath = path.join(homePath, '.claude', 'settings.json');
  await removeFromSettings(settingsPath, hookPaths);
}

async function mergeSettings(
  settingsPath: string,
  hookPaths: Record<string, string>,
): Promise<void> {
  const settings = await readSettings(settingsPath);
  const hooks = ensureHooksObject(settings);
  for (const [event, commandPath] of Object.entries(hookPaths)) {
    upsertHookEntry(hooks, event, commandPath);
  }
  settings.hooks = hooks;
  await writeSettings(settingsPath, settings);
}

async function removeFromSettings(
  settingsPath: string,
  hookPaths: Record<string, string>,
): Promise<void> {
  let settings: Record<string, unknown>;
  try {
    settings = await readSettings(settingsPath);
  } catch {
    return;
  }
  const hooks = ensureHooksObject(settings);
  for (const [event, commandPath] of Object.entries(hookPaths)) {
    removeHookEntry(hooks, event, commandPath);
  }
  settings.hooks = hooks;
  await writeSettings(settingsPath, settings);
}

async function readSettings(settingsPath: string): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await fs.readFile(settingsPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  if (raw.trim().length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Refusing to merge into malformed ${settingsPath}: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Refusing to merge into malformed ${settingsPath}: not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

async function writeSettings(settingsPath: string, settings: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

type HookEntry = {
  type: 'command';
  command: string;
};

type HookGroup = {
  matcher?: string;
  hooks: HookEntry[];
};

type HooksMap = Record<string, HookGroup[]>;

function ensureHooksObject(settings: Record<string, unknown>): HooksMap {
  const existing = settings.hooks;
  if (existing === undefined) return {};
  if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
    throw new Error('Refusing to merge: settings.hooks is present but not an object');
  }
  return existing as HooksMap;
}

function shellQuote(commandPath: string): string {
  // Claude Code passes the `command` value to /bin/sh -c; macOS userData lives
  // under /Users/<user>/Library/Application Support/... so the path contains a
  // space and must be quoted to survive shell tokenization.
  const escaped = commandPath.replace(/'/g, `'\\''`);
  return `'${escaped}'`;
}

function upsertHookEntry(hooks: HooksMap, eventName: string, commandPath: string): void {
  const groups = ensureEventArray(hooks, eventName);
  const cleaned = stripArborescentEntries(groups, commandPath);
  cleaned.push({
    matcher: '*',
    hooks: [{ type: 'command', command: shellQuote(commandPath) }],
  });
  hooks[eventName] = cleaned;
}

function removeHookEntry(hooks: HooksMap, eventName: string, commandPath: string): void {
  const existing = hooks[eventName];
  if (!Array.isArray(existing)) return;
  hooks[eventName] = stripArborescentEntries(existing, commandPath);
}

function ensureEventArray(hooks: HooksMap, eventName: string): HookGroup[] {
  const existing = hooks[eventName];
  if (existing === undefined) return [];
  if (!Array.isArray(existing)) {
    throw new Error(`Refusing to merge: settings.hooks.${eventName} is present but not an array`);
  }
  return existing;
}

function stripArborescentEntries(groups: HookGroup[], commandPath: string): HookGroup[] {
  // Match both the bare path (legacy installs that broke on paths with spaces)
  // and the shell-quoted form (current).
  const quoted = shellQuote(commandPath);
  const result: HookGroup[] = [];
  for (const group of groups) {
    if (!group || !Array.isArray(group.hooks)) {
      result.push(group);
      continue;
    }
    const remaining = group.hooks.filter(
      (h) => !(h && h.type === 'command' && (h.command === commandPath || h.command === quoted))
    );
    if (remaining.length === 0) continue;
    if (remaining.length !== group.hooks.length) {
      result.push({ ...group, hooks: remaining });
    } else {
      result.push(group);
    }
  }
  return result;
}
