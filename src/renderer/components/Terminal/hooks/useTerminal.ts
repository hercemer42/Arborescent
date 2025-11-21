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
  const userScrolledUpRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialization effect - waits for element to have dimensions
  useEffect(() => {
    if (!terminalRef.current || isInitialized) return;

    const initializeTerminal = () => {
      if (!terminalRef.current || xtermRef.current) return;

      const rect = terminalRef.current.getBoundingClientRect();

      // CRITICAL: Don't initialize xterm if element has no dimensions
      // This breaks mouse selection permanently
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      // Create xterm instance
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

      // Start scrolled to bottom (default is top of scrollback)
      xterm.scrollToBottom();

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

    // Tolerance for "at bottom" check to handle rapid xterm.js updates
    const SCROLL_TOLERANCE_LINES = 2;

    /**
     * Check if the terminal is scrolled to the bottom
     * Uses tolerance to account for rapid output scenarios where
     * xterm.js might temporarily be slightly off during updates
     */
    const isAtBottom = (): boolean => {
      const buffer = xterm.buffer.active;
      const viewport = buffer.viewportY;
      const bottomPosition = buffer.baseY + buffer.length - xterm.rows;
      return viewport >= bottomPosition - SCROLL_TOLERANCE_LINES;
    };

    /**
     * Scroll to bottom if user hasn't manually scrolled up
     * Respects user's scroll position when they've scrolled up to read history
     */
    const autoScrollToBottom = () => {
      if (!userScrolledUpRef.current) {
        xterm.scrollToBottom();
      }
    };

    /**
     * Track when user manually scrolls away from bottom
     * When user scrolls back to bottom, auto-scroll resumes
     */
    xterm.onScroll(() => {
      userScrolledUpRef.current = !isAtBottom();
    });

    /**
     * Handle terminal repaints (e.g., from tools that reprint content)
     * If user hasn't scrolled up, ensure we stay at bottom after repaint
     */
    xterm.onRender(() => {
      if (!userScrolledUpRef.current && !isAtBottom()) {
        autoScrollToBottom();
      }
    });

    // Listen for user input and send to PTY
    xterm.onData((data) => {
      window.electron.terminalWrite(id, data);
    });

    // Listen for PTY output
    const removeDataListener = window.electron.onTerminalData(id, (data) => {
      xterm.write(data, () => {
        // Some CLI tools use escape sequences that can confuse xterm.js scroll
        // position. Auto-scroll after write completes.
        autoScrollToBottom();
      });
    });

    // Listen for terminal exit
    const removeExitListener = window.electron.onTerminalExit(id, ({ exitCode }) => {
      xterm.write(`\r\n\r\n[Process exited with code ${exitCode}]\r\n`);
    });

    // Handle resize
    const handleResize = () => {
      // Check if we're at bottom before resize to preserve scroll position
      const wasAtBottom = isAtBottom();

      fitAddon.fit();
      const { cols, rows } = xterm;
      window.electron.terminalResize(id, cols, rows);
      onResize?.(cols, rows);

      // If we were at bottom and user hasn't scrolled up, stay at bottom
      if (wasAtBottom && !userScrolledUpRef.current) {
        // Use setTimeout to ensure scroll happens after xterm.js finishes layout
        setTimeout(autoScrollToBottom, 0);
      }
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
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      removeDataListener();
      removeExitListener();
      xterm.dispose();
    };
  }, [id, onResize, isInitialized]);

  return { terminalRef, xtermRef, fitAddonRef };
}
