import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTerminal } from '../terminalService';

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

describe('terminalService', () => {
  let mockTerminalCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalCreate = vi.fn().mockResolvedValue({
      id: 'pty-id',
      title: 'Terminal',
      cwd: '/home/user',
      shellCommand: '/bin/bash',
      shellArgs: [],
    });
    window.electron = {
      ...window.electron,
      terminalCreate: mockTerminalCreate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('createTerminal pinnedToBottom default', () => {
    it('new terminals start with pinnedToBottom = false so streaming output does not steal the user\'s scroll position', async () => {
      const info = await createTerminal('Terminal');

      expect(info.pinnedToBottom).toBe(false);
    });

    it('default applies regardless of explicit title, cwd, shell, or nodeUuid arguments', async () => {
      const info = await createTerminal('Build', '/bin/zsh', ['-i'], '/project', 'node-uuid-1');

      expect(info.pinnedToBottom).toBe(false);
    });
  });
});
