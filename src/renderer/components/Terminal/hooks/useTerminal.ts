import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { LIGHT_THEME } from '../terminalThemes';

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

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance with light theme as default
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

    /**
     * Check if the terminal is scrolled to the bottom
     * Uses a tolerance of 2 lines to account for rapid output scenarios
     * where xterm.js might temporarily be slightly off during updates
     */
    const isAtBottom = (): boolean => {
      const buffer = xterm.buffer.active;
      const viewport = buffer.viewportY;
      const bottomPosition = buffer.baseY + buffer.length - xterm.rows;
      // Use tolerance of 2 lines to handle rapid updates
      return viewport >= bottomPosition - 2;
    };

    /**
     * Track when user manually scrolls away from bottom
     * When user scrolls back to bottom, auto-scroll resumes
     */
    xterm.onScroll(() => {
      const atBottom = isAtBottom();
      userScrolledUpRef.current = !atBottom;
    });

    // Listen for user input and send to PTY
    xterm.onData((data) => {
      window.electron.terminalWrite(id, data);
    });

    // Listen for PTY output
    const removeDataListener = window.electron.onTerminalData(id, (data) => {
      xterm.write(data);

      // Some CLI tools (like Claude Code) use escape sequences that can confuse
      // xterm.js scroll position tracking. Only auto-scroll if user hasn't scrolled up.
      if (!userScrolledUpRef.current) {
        xterm.scrollToBottom();
      }
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
      // This ensures resize operations (like panel toggling) don't disrupt scroll
      if (wasAtBottom && !userScrolledUpRef.current) {
        // Use setTimeout to ensure scroll happens after xterm.js finishes layout
        setTimeout(() => {
          xterm.scrollToBottom();
        }, 0);
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
  }, [id, onResize]);

  return { terminalRef, xtermRef, fitAddonRef };
}
