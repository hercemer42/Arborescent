import { isShellPromptReady } from '../utils/shellPrompt';

const DEFAULT_PROMPT_READY_TIMEOUT_MS = 10000;
// Retain only a trailing window of output — enough to hold a prompt terminator
// or a bracketed-paste marker split across chunk boundaries, but bounded so a
// noisy shell that never settles on a prompt cannot grow it for the whole wait.
const READINESS_BUFFER_TAIL = 4096;

// Resolves true once the freshly spawned PTY signals its shell prompt is ready
// to accept input, or false if that signal never arrives within the timeout —
// letting the caller leave a plain shell rather than write into an unready one.
export function waitForShellPrompt(
  terminalId: string,
  timeoutMs: number = DEFAULT_PROMPT_READY_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let buffer = '';
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (ready: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
      resolve(ready);
    };

    timer = setTimeout(() => settle(false), timeoutMs);

    unsubscribe = window.electron.onTerminalData(terminalId, (data) => {
      buffer = (buffer + data).slice(-READINESS_BUFFER_TAIL);
      if (isShellPromptReady(buffer)) settle(true);
    });

    // If onTerminalData delivered a ready prompt synchronously during
    // subscription, settle ran before unsubscribe was assigned; remove the
    // now-captured listener so it cannot leak.
    if (settled) unsubscribe();
  });
}
