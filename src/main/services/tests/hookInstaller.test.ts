import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { installHooks, uninstallHooks } from '../hookInstaller';

let tmpRoot: string;
let userDataPath: string;
let homePath: string;

async function readSettings(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(path.join(homePath, '.claude', 'settings.json'), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeSettings(value: unknown): Promise<void> {
  const dir = path.join(homePath, '.claude');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify(value, null, 2), 'utf8');
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'arborescent-hook-installer-'));
  userDataPath = path.join(tmpRoot, 'userData');
  homePath = path.join(tmpRoot, 'home');
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.mkdir(homePath, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('installHooks — fresh install', () => {
  it('creates ~/.claude/settings.json when it does not exist', async () => {
    expect(await readSettings()).toBe(null);
    await installHooks({ userDataPath, homePath });
    const settings = await readSettings();
    expect(settings).not.toBe(null);
  });

  it('writes SessionStart and UserPromptSubmit entries pointing at the Arborescent-shipped scripts', async () => {
    const paths = await installHooks({ userDataPath, homePath });
    const settings = (await readSettings())! as { hooks: Record<string, unknown> };
    const sessionStart = settings.hooks.SessionStart as Array<{ hooks: Array<{ command: string }> }>;
    const userPromptSubmit = settings.hooks.UserPromptSubmit as Array<{ hooks: Array<{ command: string }> }>;
    expect(sessionStart[0].hooks[0].command).toBe(paths.sessionStart);
    expect(userPromptSubmit[0].hooks[0].command).toBe(paths.userPromptSubmit);
  });

  it('hook script files live under the user data hooks directory', async () => {
    const paths = await installHooks({ userDataPath, homePath });
    expect(path.dirname(paths.sessionStart)).toBe(path.join(userDataPath, 'hooks'));
    expect(path.dirname(paths.userPromptSubmit)).toBe(path.join(userDataPath, 'hooks'));
  });

  it('hook script files are executable', async () => {
    const paths = await installHooks({ userDataPath, homePath });
    const sessionStat = await fs.stat(paths.sessionStart);
    const promptStat = await fs.stat(paths.userPromptSubmit);
    expect(sessionStat.mode & 0o111).not.toBe(0);
    expect(promptStat.mode & 0o111).not.toBe(0);
  });

  it('creates ~/.claude when missing', async () => {
    await fs.rm(path.join(homePath, '.claude'), { recursive: true, force: true });
    await installHooks({ userDataPath, homePath });
    const stat = await fs.stat(path.join(homePath, '.claude'));
    expect(stat.isDirectory()).toBe(true);
  });
});

describe('installHooks — merge with existing settings', () => {
  it('preserves user-added SessionStart entries — Arborescent\'s entry is appended', async () => {
    await writeSettings({
      hooks: {
        SessionStart: [
          { matcher: '*', hooks: [{ type: 'command', command: '/usr/local/bin/user-script.sh' }] },
        ],
      },
    });

    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { SessionStart: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands).toContain('/usr/local/bin/user-script.sh');
    expect(commands.some((c) => c.includes('arborescent-session-start.mjs'))).toBe(true);
  });

  it('preserves user-added UserPromptSubmit entries', async () => {
    await writeSettings({
      hooks: {
        UserPromptSubmit: [
          { matcher: '*', hooks: [{ type: 'command', command: '/home/u/my-prompt-hook.sh' }] },
        ],
      },
    });

    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.UserPromptSubmit.flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands).toContain('/home/u/my-prompt-hook.sh');
    expect(commands.some((c) => c.includes('arborescent-user-prompt-submit.mjs'))).toBe(true);
  });

  it('preserves unrelated top-level keys', async () => {
    await writeSettings({
      theme: 'dark',
      anthropicApiKey: 'sk-...',
      hooks: {},
    });

    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as Record<string, unknown>;
    expect(settings.theme).toBe('dark');
    expect(settings.anthropicApiKey).toBe('sk-...');
  });

  it('preserves entries in other hook sections', async () => {
    await writeSettings({
      hooks: {
        Stop: [{ matcher: '*', hooks: [{ type: 'command', command: '/u/stop-hook.sh' }] }],
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/u/bash-guard.sh' }] }],
      },
    });

    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    expect(settings.hooks.Stop[0].hooks[0].command).toBe('/u/stop-hook.sh');
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('/u/bash-guard.sh');
  });

  it('two installations in a row produce the same final settings (idempotent)', async () => {
    await installHooks({ userDataPath, homePath });
    const first = await readSettings();
    await installHooks({ userDataPath, homePath });
    const second = await readSettings();
    expect(second).toEqual(first);
  });
});

describe('installHooks — upgrade path', () => {
  it('replaces an older Arborescent entry with the same command path on reinstall', async () => {
    await installHooks({ userDataPath, homePath });
    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { SessionStart: Array<{ hooks: Array<{ command: string }> }> } };
    const arborescentCount = settings.hooks.SessionStart
      .flatMap((g) => g.hooks.map((h) => h.command))
      .filter((c) => c.includes('arborescent-session-start.mjs'))
      .length;
    expect(arborescentCount).toBe(1);
  });
});

describe('installHooks — failure modes', () => {
  it('refuses to merge into a malformed settings file and surfaces a clear error', async () => {
    const dir = path.join(homePath, '.claude');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'settings.json'), '{ not-json', 'utf8');

    await expect(installHooks({ userDataPath, homePath })).rejects.toThrow(/malformed/);
  });

  it('refuses to merge when settings.hooks is present but not an object', async () => {
    await writeSettings({ hooks: 'oops' });
    await expect(installHooks({ userDataPath, homePath })).rejects.toThrow(/not an object/);
  });

  it('refuses to merge when settings.hooks.SessionStart is present but not an array', async () => {
    await writeSettings({ hooks: { SessionStart: { single: 'object' } } });
    await expect(installHooks({ userDataPath, homePath })).rejects.toThrow(/not an array/);
  });
});

describe('uninstallHooks', () => {
  it('removes Arborescent-shipped hook entries only', async () => {
    await writeSettings({
      hooks: {
        SessionStart: [
          { matcher: '*', hooks: [{ type: 'command', command: '/usr/local/bin/user-script.sh' }] },
        ],
      },
    });
    await installHooks({ userDataPath, homePath });

    await uninstallHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { SessionStart: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands).toContain('/usr/local/bin/user-script.sh');
    expect(commands.some((c) => c.includes('arborescent-session-start.mjs'))).toBe(false);
  });

  it('is safe to call when no Arborescent entries exist — no-op, no error', async () => {
    await writeSettings({ hooks: { SessionStart: [] } });
    await expect(uninstallHooks({ userDataPath, homePath })).resolves.toBeUndefined();
  });

  it('is safe to call when the settings file does not exist', async () => {
    await expect(uninstallHooks({ userDataPath, homePath })).resolves.toBeUndefined();
  });
});

describe('installHooks — boundary inputs', () => {
  it('handles an empty settings file (just {})', async () => {
    await writeSettings({});
    await installHooks({ userDataPath, homePath });
    const settings = (await readSettings())! as { hooks: Record<string, unknown> };
    expect(settings.hooks).toBeDefined();
  });

  it('handles a settings file containing only whitespace', async () => {
    const dir = path.join(homePath, '.claude');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'settings.json'), '   \n  \n', 'utf8');
    await installHooks({ userDataPath, homePath });
    const settings = (await readSettings())! as { hooks: Record<string, unknown> };
    expect(settings.hooks).toBeDefined();
  });
});

describe('installHooks — Stop hook (PR6)', () => {
  it('returns a stop path under the user-data hooks directory alongside the other two', async () => {
    const paths = await installHooks({ userDataPath, homePath }) as { sessionStart: string; userPromptSubmit: string; stop: string };
    expect(paths.stop).toBeDefined();
    expect(path.dirname(paths.stop)).toBe(path.join(userDataPath, 'hooks'));
  });

  it('writes a Stop entry pointing at the Arborescent-shipped Stop script', async () => {
    const paths = await installHooks({ userDataPath, homePath }) as { stop: string };
    const settings = (await readSettings())! as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    const stop = settings.hooks.Stop;
    expect(stop).toBeDefined();
    expect(stop[0].hooks[0].command).toBe(paths.stop);
  });

  it('the Stop hook script file is executable', async () => {
    const paths = await installHooks({ userDataPath, homePath }) as { stop: string };
    const stat = await fs.stat(paths.stop);
    expect(stat.mode & 0o111).not.toBe(0);
  });

  it('preserves user-added Stop entries — Arborescent\'s entry is appended', async () => {
    await writeSettings({
      hooks: {
        Stop: [
          { matcher: '*', hooks: [{ type: 'command', command: '/u/my-stop-hook.sh' }] },
        ],
      },
    });

    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands).toContain('/u/my-stop-hook.sh');
    expect(commands.some((c) => c.includes('arborescent-stop'))).toBe(true);
  });

  it('two installations in a row keep a single Arborescent Stop entry (idempotent)', async () => {
    await installHooks({ userDataPath, homePath });
    await installHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } };
    const arborescentCount = settings.hooks.Stop
      .flatMap((g) => g.hooks.map((h) => h.command))
      .filter((c) => c.includes('arborescent-stop'))
      .length;
    expect(arborescentCount).toBe(1);
  });

  it('preserves Arborescent\'s SessionStart and UserPromptSubmit entries when installing Stop', async () => {
    const paths = await installHooks({ userDataPath, homePath }) as { sessionStart: string; userPromptSubmit: string; stop: string };
    const settings = (await readSettings())! as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
    const all = (event: string) => settings.hooks[event].flatMap((g) => g.hooks.map((h) => h.command));
    expect(all('SessionStart')).toContain(paths.sessionStart);
    expect(all('UserPromptSubmit')).toContain(paths.userPromptSubmit);
    expect(all('Stop')).toContain(paths.stop);
  });

  it('refuses to merge when settings.hooks.Stop is present but not an array', async () => {
    await writeSettings({ hooks: { Stop: { single: 'object' } } });
    await expect(installHooks({ userDataPath, homePath })).rejects.toThrow(/not an array/);
  });
});

describe('uninstallHooks — Stop hook (PR6)', () => {
  it('removes only the Arborescent Stop entry, leaving user entries intact', async () => {
    await writeSettings({
      hooks: {
        Stop: [
          { matcher: '*', hooks: [{ type: 'command', command: '/u/my-stop-hook.sh' }] },
        ],
      },
    });
    await installHooks({ userDataPath, homePath });

    await uninstallHooks({ userDataPath, homePath });

    const settings = (await readSettings())! as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command));
    expect(commands).toContain('/u/my-stop-hook.sh');
    expect(commands.some((c) => c.includes('arborescent-stop'))).toBe(false);
  });
});
