import { useEffect } from 'react';

interface UseBrowserNavigationSyncOptions {
  activeTabId: string | null;
  getActiveWebview: () => HTMLWebViewElement | null;
  updateNavigationState: () => void;
  updateAddressBarFromWebview: () => void;
}

export function useBrowserNavigationSync({
  activeTabId,
  getActiveWebview,
  updateNavigationState,
  updateAddressBarFromWebview,
}: UseBrowserNavigationSyncOptions) {
  useEffect(() => {
    const webview = getActiveWebview();
    if (!webview) return;

    const handleNavigation = () => {
      updateNavigationState();
      updateAddressBarFromWebview();
    };

    // Update immediately on mount/tab change
    handleNavigation();

    // Listen for navigation events
    webview.addEventListener('did-navigate', handleNavigation);
    webview.addEventListener('did-navigate-in-page', handleNavigation);
    webview.addEventListener('dom-ready', handleNavigation);

    return () => {
      webview.removeEventListener('did-navigate', handleNavigation);
      webview.removeEventListener('did-navigate-in-page', handleNavigation);
      webview.removeEventListener('dom-ready', handleNavigation);
    };
  }, [activeTabId, getActiveWebview, updateNavigationState, updateAddressBarFromWebview]);
}
