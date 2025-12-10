import { useState, useCallback } from 'react';

interface UseBrowserNavigationOptions {
  getActiveWebview: () => HTMLWebViewElement | null;
}

export function useBrowserNavigation({ getActiveWebview }: UseBrowserNavigationOptions) {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const updateNavigationState = useCallback(() => {
    const webview = getActiveWebview();
    if (webview) {
      try {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      } catch {
        // Webview not ready yet
      }
    }
  }, [getActiveWebview]);

  const handleBack = useCallback(() => {
    const webview = getActiveWebview();
    if (webview && webview.canGoBack()) {
      webview.goBack();
    }
  }, [getActiveWebview]);

  const handleForward = useCallback(() => {
    const webview = getActiveWebview();
    if (webview && webview.canGoForward()) {
      webview.goForward();
    }
  }, [getActiveWebview]);

  const handleReload = useCallback(() => {
    const webview = getActiveWebview();
    if (webview) {
      webview.reload();
    }
  }, [getActiveWebview]);

  return {
    canGoBack,
    canGoForward,
    updateNavigationState,
    handleBack,
    handleForward,
    handleReload,
  };
}
