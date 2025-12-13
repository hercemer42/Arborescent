import { useEffect } from 'react';

interface UseBrowserCloseShortcutOptions {
  activeTabId: string | null;
  onClose: (tabId: string) => void;
}

export function useBrowserCloseShortcut({ activeTabId, onClose }: UseBrowserCloseShortcutOptions) {
  useEffect(() => {
    return window.electron.onCloseBrowserTab(() => {
      if (activeTabId) {
        onClose(activeTabId);
      }
    });
  }, [activeTabId, onClose]);
}
