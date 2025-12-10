import { useRef, useCallback } from 'react';

export function useBrowserWebviewRefs(activeTabId: string | null) {
  const webviewRefs = useRef<Map<string, HTMLWebViewElement>>(new Map());

  const registerWebview = useCallback((id: string, webview: HTMLWebViewElement | null) => {
    if (webview) {
      webviewRefs.current.set(id, webview);
    } else {
      webviewRefs.current.delete(id);
    }
  }, []);

  const getActiveWebview = useCallback((): HTMLWebViewElement | null => {
    if (!activeTabId) return null;
    return webviewRefs.current.get(activeTabId) || null;
  }, [activeTabId]);

  const unregisterWebview = useCallback((id: string) => {
    webviewRefs.current.delete(id);
  }, []);

  return {
    registerWebview,
    getActiveWebview,
    unregisterWebview,
  };
}
