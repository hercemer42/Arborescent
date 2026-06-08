import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { LIGHT_THEME, DARK_THEME } from '../terminalThemes';
import { clipChunkAfterWatermark } from '../terminalReplay';
import { useTerminalKeyboard } from './useTerminalKeyboard';
import { usePreferencesStore } from '../../../store/preferences/preferencesStore';
import { logger } from '../../../services/logger';
import {
  registerTerminalFocus,
  unregisterTerminalFocus,
} from '../../../services/terminalFocusRegistry';

export type TerminalInitStatus = 'loading' | 'ready' | 'error';

// The ResizeObserver does not always deliver a callback when the container gains
// size (intermittent on display:none -> block), which would leave the pane blank
// indefinitely. Poll init as well, and after a deadline surface an error if the
// pane is visible but still unmounted.
const INIT_POLL_INTERVAL_MS = 120;
const INIT_DEADLINE_MS = 8000;

interface UseTerminalOptions {
  id: string;
  pinnedToBottom?: boolean;
  onResize?: (cols: number, rows: number) => void;
}

/**
 * Lifecycle for an xterm.js instance bound to an Electron PTY.
 *
 * Layout quirk: the element may mount with zero width/height (display:none
 * or flex:0 before layout), so initialization is deferred behind a
 * ResizeObserver that retries on every size change until the element
 * actually has dimensions. Once xterm is live, a second ResizeObserver
 * drives runtime SIGWINCH and a display:none->block repaint.
 *
 * The old shape of this hook split init, theme, and handler wiring into
 * four separate effects that interleaved via an isInitialized state.
 * That made the teardown order hard to reason about. Consolidated here
 * into a single mount effect + a theme-reactive effect.
 */
export function useTerminal({ id, pinnedToBottom = false, onResize }: UseTerminalOptions) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const pinnedToBottomRef = useRef(pinnedToBottom);
  const prevPinnedToBottomRef = useRef(pinnedToBottom);
  const wasHiddenRef = useRef(false);
  const onResizeRef = useRef(onResize);
  const [isInitialized, setIsInitialized] = useState(false);
  const [status, setStatus] = useState<TerminalInitStatus>('loading');
  const theme = usePreferencesStore((state) => state.theme);

  // Keep refs in sync with props without re-triggering the mount effect.
  useEffect(() => {
    pinnedToBottomRef.current = pinnedToBottom;
  }, [pinnedToBottom]);

  // On a false → true transition, reconcile the viewport so the toggle
  // behaves as "anchor now" — without it the view stays parked on stale rows
  // until the next byte arrives. Grid sizing stays with the runtime observer,
  // so no fit() here.
  useEffect(() => {
    const wasPinned = prevPinnedToBottomRef.current;
    prevPinnedToBottomRef.current = pinnedToBottom;
    if (wasPinned || !pinnedToBottom) return;

    const xterm = xtermRef.current;
    const container = terminalRef.current;
    if (!xterm || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (xterm.rows > 0) {
      xterm.refresh(0, xterm.rows - 1);
    }
    xterm.scrollToBottom();
  }, [pinnedToBottom]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    if (!terminalRef.current) return;

    let disposed = false;
    const disposers: (() => void)[] = [];
    let retryObserver: ResizeObserver | null = null;
    let initPollTimer: ReturnType<typeof setTimeout> | null = null;
    let errored = false;
    const openedAt = performance.now();

    const wireRuntimeHandlers = (xterm: XTerm, fitAddon: FitAddon, container: HTMLDivElement) => {
      xterm.onData((data) => {
        void window.electron.terminalWrite(id, data);
      });

      let firstWriteDone = false;
      const forceFirstRepaint = () => {
        if (firstWriteDone) return;
        firstWriteDone = true;
        // xterm's first render after open() can miss the initial write — force a repaint.
        requestAnimationFrame(() => {
          if (xtermRef.current && xtermRef.current.rows > 0) {
            xtermRef.current.refresh(0, xtermRef.current.rows - 1);
          }
        });
      };

      const writeOutput = (data: string) => {
        if (!data) return;
        xterm.write(data);
        if (pinnedToBottomRef.current) {
          xterm.scrollToBottom();
        }
        forceFirstRepaint();
      };

      // The shell may have drawn its prompt before this listener attached, so the
      // missed bytes live only in the main-process buffer. Hold live chunks until
      // that buffer is replayed, then write each live chunk with the already-shown
      // range clipped off by its offset watermark so nothing renders twice.
      let replayWatermark: number | null = null;
      const pendingLive: { data: string; endOffset?: number }[] = [];

      const flushPendingLive = () => {
        const watermark = replayWatermark ?? 0;
        for (const chunk of pendingLive.splice(0)) {
          writeOutput(clipChunkAfterWatermark(chunk.data, chunk.endOffset, watermark));
        }
      };

      const removeDataListener = window.electron.onTerminalData(id, (data, endOffset) => {
        if (replayWatermark === null) {
          pendingLive.push({ data, endOffset });
          return;
        }
        writeOutput(clipChunkAfterWatermark(data, endOffset, replayWatermark));
      });

      const fetchBufferedOutput = window.electron.getTerminalBufferedOutput;
      if (fetchBufferedOutput) {
        void fetchBufferedOutput(id)
          .then(({ data, endOffset }) => {
            if (disposed) return;
            writeOutput(data);
            replayWatermark = endOffset;
            flushPendingLive();
          })
          .catch(() => {
            if (disposed) return;
            replayWatermark = 0;
            flushPendingLive();
          });
      } else {
        replayWatermark = 0;
        flushPendingLive();
      }

      const removeExitListener = window.electron.onTerminalExit(id, ({ exitCode }) => {
        xterm.write(`\r\n\r\n[Process exited with code ${exitCode}]\r\n`);
      });

      // Runtime resize via ResizeObserver + window resize, debounced to rAF.
      let resizeRafId: number | null = null;
      const handleResize = () => {
        if (resizeRafId !== null) {
          cancelAnimationFrame(resizeRafId);
        }
        resizeRafId = requestAnimationFrame(() => {
          resizeRafId = null;
          const rect = terminalRef.current?.getBoundingClientRect();
          if (!rect || rect.width === 0 || rect.height === 0) {
            wasHiddenRef.current = true;
            return;
          }
          fitAddon.fit();
          const { cols, rows } = xterm;
          if (wasHiddenRef.current && rows > 0) {
            wasHiddenRef.current = false;
            // display:none leaves xterm's renderer and viewport stale — repaint the
            // buffer and reconcile the scroll position so the viewport matches the buffer.
            xterm.refresh(0, rows - 1);
            if (pinnedToBottomRef.current) {
              xterm.scrollToBottom();
            }
          }
          void window.electron.terminalResize(id, cols, rows);
          onResizeRef.current?.(cols, rows);
        });
      };

      const runtimeObserver = new ResizeObserver(handleResize);
      runtimeObserver.observe(container);
      window.addEventListener('resize', handleResize);

      // SIGWINCH nudge so the shell reprints its prompt if it landed before onTerminalData attached.
      fitAddon.fit();
      const { cols, rows } = xterm;
      void window.electron.terminalResize(id, cols - 1, rows).then(() => {
        if (!disposed) {
          void window.electron.terminalResize(id, cols, rows);
        }
      });

      disposers.push(
        removeDataListener,
        removeExitListener,
        () => runtimeObserver.disconnect(),
        () => window.removeEventListener('resize', handleResize),
        () => {
          if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
        },
      );
    };

    const stopInitWatchers = () => {
      if (retryObserver) {
        retryObserver.disconnect();
        retryObserver = null;
      }
      if (initPollTimer !== null) {
        clearTimeout(initPollTimer);
        initPollTimer = null;
      }
    };

    const tryInit = () => {
      if (disposed || errored || xtermRef.current || !terminalRef.current) return;
      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      let xterm: XTerm;
      let fitAddon: FitAddon;
      try {
        xterm = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
        });

        fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(terminalRef.current);
        fitAddon.fit();
      } catch (error) {
        errored = true;
        stopInitWatchers();
        setStatus('error');
        logger.error(`Terminal ${id} failed to initialise`, error as Error, 'Terminal', false);
        return;
      }

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      stopInitWatchers();

      wireRuntimeHandlers(xterm, fitAddon, terminalRef.current);

      registerTerminalFocus(id, () => xterm.focus());
      disposers.push(() => unregisterTerminalFocus(id));

      // Push xterm.dispose last so teardown always runs listeners/observers before dispose.
      disposers.push(() => xterm.dispose());

      // If the anchor was toggled on before init completed, the transition effect
      // bailed and never rescheduled — catch it here so the view doesn't wait
      // for the next byte to land at the bottom.
      if (pinnedToBottomRef.current && xterm.rows > 0) {
        xterm.refresh(0, xterm.rows - 1);
        xterm.scrollToBottom();
      }

      setStatus('ready');
      logger.debug(`Terminal ${id} first render in ${Math.round(performance.now() - openedAt)}ms`, 'Terminal');
      setIsInitialized(true);
    };

    tryInit();

    if (!xtermRef.current && !errored) {
      retryObserver = new ResizeObserver(tryInit);
      retryObserver.observe(terminalRef.current);

      const pollInit = () => {
        initPollTimer = null;
        if (disposed || errored || xtermRef.current) return;
        tryInit();
        if (disposed || errored || xtermRef.current) return;
        if (performance.now() - openedAt >= INIT_DEADLINE_MS) {
          // The pane has had a real size but still has not mounted — surface it
          // instead of staying blank. A pane that is merely still hidden keeps
          // waiting on the ResizeObserver rather than erroring.
          const rect = terminalRef.current?.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            errored = true;
            stopInitWatchers();
            setStatus('error');
            logger.error(`Terminal ${id} did not render within ${INIT_DEADLINE_MS}ms`, undefined, 'Terminal', false);
          }
          return;
        }
        initPollTimer = setTimeout(pollInit, INIT_POLL_INTERVAL_MS);
      };
      initPollTimer = setTimeout(pollInit, INIT_POLL_INTERVAL_MS);
    }

    return () => {
      disposed = true;
      if (retryObserver) retryObserver.disconnect();
      if (initPollTimer !== null) clearTimeout(initPollTimer);
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          // ignore — one failing disposer shouldn't block the rest.
        }
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // theme is intentionally excluded: we only use it for the initial xterm
    // theme option. Runtime theme updates happen in the effect below, which
    // reaches into xtermRef.current.options without re-creating the terminal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useTerminalKeyboard(xtermRef, isInitialized);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
  }, [theme]);

  return { terminalRef, xtermRef, fitAddonRef, status };
}
