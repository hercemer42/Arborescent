import { isShellPromptReady } from '../utils/shellPrompt';

// Generous enough to cover a slow interactive rc (nvm/conda/p10k can take several
// seconds, more under the concurrent spawn load of the launch resume fan-out).
const DEFAULT_PROMPT_READY_TIMEOUT_MS = 30000;
const READINESS_BUFFER_TAIL = 4096;
// Once output has arrived and then stopped for this long, treat the shell as
// ready: it has drawn its prompt and gone idle waiting for input. This is more
// robust than matching a specific prompt string — it recovers when a slow or
// custom prompt draws something we don't recognise — and it resolves as soon as
// the shell settles rather than waiting out the full timeout.
const QUIET_SETTLE_MS = 1000;

// Resolves true once the freshly spawned PTY signals its shell prompt is ready
// to accept input, or false if no output ever settles within the timeout —
// letting the caller leave a plain shell rather than write into an unready one.
export function waitForShellPrompt(
  terminalId: string,
  timeoutMs: number = DEFAULT_PROMPT_READY_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let buffer = '';
    let unsubscribe: (() => void) | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;

    const settle = (ready: boolean) => {
      if (settled) return;
      settled = true;
      if (hardTimer) clearTimeout(hardTimer);
      if (quietTimer) clearTimeout(quietTimer);
      unsubscribe?.();
      resolve(ready);
    };

    const armQuietTimer = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => settle(true), QUIET_SETTLE_MS);
    };

    const consume = () => {
      if (settled) return;
      if (isShellPromptReady(buffer)) {
        settle(true);
        return;
      }
      // Output exists but isn't a recognised prompt yet — wait for it to settle.
      armQuietTimer();
    };

    hardTimer = setTimeout(() => settle(false), timeoutMs);

    // Subscribe before reading the replay buffer so no output emitted between
    // the two is lost.
    unsubscribe = window.electron.onTerminalData(terminalId, (data) => {
      buffer = (buffer + data).slice(-READINESS_BUFFER_TAIL);
      consume();
    });

    // If onTerminalData delivered a ready prompt synchronously during
    // subscription, settle ran before unsubscribe was assigned; remove the
    // now-captured listener so it cannot leak.
    if (settled) {
      unsubscribe();
      return;
    }

    // A freshly spawned shell may have drawn its prompt before we subscribed —
    // common in the launch resume fan-out, where every terminal spawns up front
    // and resume happens after. onTerminalData does not replay, so seed from the
    // main-side buffer of output already emitted. Prepend it (older than any live
    // chunk) and re-test.
    const fetchRecentOutput = window.electron.getTerminalRecentOutput;
    if (fetchRecentOutput) {
      void fetchRecentOutput(terminalId)
        .then((seed) => {
          if (settled || !seed) return;
          buffer = (seed + buffer).slice(-READINESS_BUFFER_TAIL);
          consume();
        })
        .catch(() => {});
    }
  });
}
