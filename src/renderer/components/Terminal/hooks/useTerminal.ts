import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { LIGHT_THEME } from '../terminalThemes';
import { useTerminalKeyboard } from './useTerminalKeyboard';

interface UseTerminalOptions {
  id: string;
  onResize?: (cols: number, rows: number) => void;
}

/**
 * Hook to manage xterm.js terminal instance lifecycle
 * Handles initialization, event listeners, resize, and cleanup
 */
export function useTerminal({ id, onResize }: UseTerminalOptions) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const autoScrollEnabledRef = useRef(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialization effect - waits for element to have dimensions
  useEffect(() => {
    if (!terminalRef.current || isInitialized) return;

    const initializeTerminal = () => {
      if (!terminalRef.current || xtermRef.current) return;

      const rect = terminalRef.current.getBoundingClientRect();

      // Don't initialize xterm if element has no dimensions
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: LIGHT_THEME,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);

      xterm.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;
      setIsInitialized(true);
    };

    // Try immediate initialization
    initializeTerminal();

    // If not initialized, watch for element to get dimensions
    if (!isInitialized) {
      const resizeObserver = new ResizeObserver(() => {
        initializeTerminal();
      });

      resizeObserver.observe(terminalRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [id, isInitialized]);

  // Setup keyboard shortcuts
  useTerminalKeyboard(xtermRef.current);

  // Main effect - sets up event handlers after initialization
  useEffect(() => {
    if (!isInitialized || !xtermRef.current || !fitAddonRef.current || !terminalRef.current) return;

    const xterm = xtermRef.current;
    const fitAddon = fitAddonRef.current;

    // Check if terminal is scrolled to bottom
    const isAtBottom = () => {
      const buffer = xterm.buffer.active;
      return buffer.viewportY >= buffer.baseY;
    };

    // Track scroll position to enable/disable auto-scroll
    xterm.onScroll(() => {
      autoScrollEnabledRef.current = isAtBottom();
    });

    // Listen for user input and send to PTY
    xterm.onData((data) => {
      window.electron.terminalWrite(id, data);
    });

    // Listen for PTY output
    const removeDataListener = window.electron.onTerminalData(id, (data) => {
      xterm.write(data);
      if (autoScrollEnabledRef.current) {
        xterm.scrollToBottom();
      }
    });

    // Listen for terminal exit
    const removeExitListener = window.electron.onTerminalExit(id, ({ exitCode }) => {
      xterm.write(`\r\n\r\n[Process exited with code ${exitCode}]\r\n`);
    });

    // Handle resize - wrapped in requestAnimationFrame to ensure layout is complete
    // This fixes issues when container visibility changes (display: none -> block)
    // where ResizeObserver fires before browser completes layout reflow
    let resizeRafId: number | null = null;
    const handleResize = () => {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        // Skip if container has no dimensions (still hidden)
        const rect = terminalRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) {
          return;
        }
        fitAddon.fit();
        const { cols, rows } = xterm;
        window.electron.terminalResize(id, cols, rows);
        onResize?.(cols, rows);
      });
    };

    // Watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(terminalRef.current);

    // Also listen to window resize
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (resizeRafId !== null) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      removeDataListener();
      removeExitListener();
      xterm.dispose();
    };
  }, [id, onResize, isInitialized]);

  return { terminalRef, xtermRef, fitAddonRef };
}
