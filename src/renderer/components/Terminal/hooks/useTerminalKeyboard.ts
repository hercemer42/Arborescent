import { useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';

/**
 * Hook to handle terminal keyboard shortcuts for copy/paste
 * Implements standard terminal shortcuts: Ctrl+Shift+C/V
 */
export function useTerminalKeyboard(xterm: XTerm | null) {
  useEffect(() => {
    if (!xterm) return;

    // Handle copy/paste with standard terminal shortcuts (Ctrl+Shift+C/V)
    xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Only handle keydown events to avoid double-firing
      if (e.type !== 'keydown') {
        return true;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Copy: Ctrl+Shift+C (or Cmd+Shift+C on Mac)
      if (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'c') {
        const selection = xterm.getSelection();
        if (selection) {
          e.preventDefault();
          navigator.clipboard.writeText(selection);
          return false;
        }
      }

      // Paste: Ctrl+Shift+V (or Cmd+Shift+V on Mac)
      if (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          xterm.paste(text);
        });
        return false;
      }

      return true; // Let xterm handle all other keys
    });
  }, [xterm]);
}
