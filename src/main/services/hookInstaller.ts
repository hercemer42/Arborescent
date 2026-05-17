import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from './logger';
import { SESSION_START_HOOK_SCRIPT, USER_PROMPT_SUBMIT_HOOK_SCRIPT } from './hookScripts';

const SESSION_START_FILENAME = 'arborescent-session-start.mjs';
const USER_PROMPT_SUBMIT_FILENAME = 'arborescent-user-prompt-submit.mjs';

export type HookInstallPaths = {
  sessionStart: string;
  userPromptSubmit: string;
};

export type HookInstallerDeps = {
  userDataPath: string;
  homePath?: string;
};

export async function installHooks(deps: HookInstallerDeps): Promise<HookInstallPaths> {
  const hooksDir = path.join(deps.userDataPath, 'hooks');
  await fs.mkdir(hooksDir, { recursive: true });

  const sessionStartPath = path.join(hooksDir, SESSION_START_FILENAME);
  const userPromptSubmitPath = path.join(hooksDir, USER_PROMPT_SUBMIT_FILENAME);

  await fs.writeFile(sessionStartPath, SESSION_START_HOOK_SCRIPT, { mode: 0o755 });
  await fs.writeFile(userPromptSubmitPath, USER_PROMPT_SUBMIT_HOOK_SCRIPT, { mode: 0o755 });
  // writeFile's `mode` only applies when the file is created. On reinstall the file
  // already exists, so the mode is silently ignored — chmod explicitly guarantees +x.
  await fs.chmod(sessionStartPath, 0o755);
  await fs.chmod(userPromptSubmitPath, 0o755);

  const homePath = deps.homePath ?? os.homedir();
  const settingsPath = path.join(homePath, '.claude', 'settings.json');
  await mergeSettings(settingsPath, sessionStartPath, userPromptSubmitPath);

  logger.info('Arborescent hooks installed', 'HookInstaller');
  return { sessionStart: sessionStartPath, userPromptSubmit: userPromptSubmitPath };
}

export async function uninstallHooks(deps: HookInstallerDeps): Promise<void> {
  const hooksDir = path.join(deps.userDataPath, 'hooks');
  const sessionStartPath = path.join(hooksDir, SESSION_START_FILENAME);
  const userPromptSubmitPath = path.join(hooksDir, USER_PROMPT_SUBMIT_FILENAME);

  const homePath = deps.homePath ?? os.homedir();
  const settingsPath = path.join(homePath, '.claude', 'settings.json');
  await removeFromSettings(settingsPath, sessionStartPath, userPromptSubmitPath);
}

async function mergeSettings(
  settingsPath: string,
  sessionStartPath: string,
  userPromptSubmitPath: string
): Promise<void> {
  const settings = await readSettings(settingsPath);
  const hooks = ensureHooksObject(settings);
  upsertHookEntry(hooks, 'SessionStart', sessionStartPath);
  upsertHookEntry(hooks, 'UserPromptSubmit', userPromptSubmitPath);
  settings.hooks = hooks;
  await writeSettings(settingsPath, settings);
}

async function removeFromSettings(
  settingsPath: string,
  sessionStartPath: string,
  userPromptSubmitPath: string
): Promise<void> {
  let settings: Record<string, unknown>;
  try {
    settings = await readSettings(settingsPath);
  } catch {
    return;
  }
  const hooks = ensureHooksObject(settings);
  removeHookEntry(hooks, 'SessionStart', sessionStartPath);
  removeHookEntry(hooks, 'UserPromptSubmit', userPromptSubmitPath);
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

function upsertHookEntry(hooks: HooksMap, eventName: string, commandPath: string): void {
  const groups = ensureEventArray(hooks, eventName);
  const cleaned = stripArborescentEntries(groups, commandPath);
  cleaned.push({
    matcher: '*',
    hooks: [{ type: 'command', command: commandPath }],
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
  const result: HookGroup[] = [];
  for (const group of groups) {
    if (!group || !Array.isArray(group.hooks)) {
      result.push(group);
      continue;
    }
    const remaining = group.hooks.filter(
      (h) => !(h && h.type === 'command' && h.command === commandPath)
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
