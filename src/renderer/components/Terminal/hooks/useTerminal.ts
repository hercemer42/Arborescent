import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { LIGHT_THEME, DARK_THEME } from '../terminalThemes';
import { useTerminalKeyboard } from './useTerminalKeyboard';
import { usePreferencesStore } from '../../../store/preferences/preferencesStore';

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
export function useTerminal({ id, pinnedToBottom = true, onResize }: UseTerminalOptions) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const pinnedToBottomRef = useRef(pinnedToBottom);
  const wasHiddenRef = useRef(false);
  const onResizeRef = useRef(onResize);
  const [isInitialized, setIsInitialized] = useState(false);
  const theme = usePreferencesStore((state) => state.theme);

  // Keep refs in sync with props without re-triggering the mount effect.
  useEffect(() => {
    pinnedToBottomRef.current = pinnedToBottom;
  }, [pinnedToBottom]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    if (!terminalRef.current) return;

    let disposed = false;
    const disposers: (() => void)[] = [];
    let retryObserver: ResizeObserver | null = null;

    const wireRuntimeHandlers = (xterm: XTerm, fitAddon: FitAddon, container: HTMLDivElement) => {
      xterm.onData((data) => {
        void window.electron.terminalWrite(id, data);
      });

      let firstDataReceived = false;
      const removeDataListener = window.electron.onTerminalData(id, (data) => {
        xterm.write(data);
        if (pinnedToBottomRef.current) {
          xterm.scrollToBottom();
        }
        if (!firstDataReceived) {
          firstDataReceived = true;
          // xterm's first render after open() can miss the initial write — force a repaint.
          requestAnimationFrame(() => {
            if (xtermRef.current && xtermRef.current.rows > 0) {
              xtermRef.current.refresh(0, xtermRef.current.rows - 1);
            }
          });
        }
      });

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

    const tryInit = () => {
      if (disposed || xtermRef.current || !terminalRef.current) return;
      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      if (retryObserver) {
        retryObserver.disconnect();
        retryObserver = null;
      }

      wireRuntimeHandlers(xterm, fitAddon, terminalRef.current);

      // Push xterm.dispose last so teardown always runs listeners/observers before dispose.
      disposers.push(() => xterm.dispose());

      setIsInitialized(true);
    };

    tryInit();

    if (!xtermRef.current) {
      retryObserver = new ResizeObserver(tryInit);
      retryObserver.observe(terminalRef.current);
    }

    return () => {
      disposed = true;
      if (retryObserver) retryObserver.disconnect();
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

  return { terminalRef, xtermRef, fitAddonRef };
}
