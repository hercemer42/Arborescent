import { useEffect, useRef, useCallback } from 'react';
import { useBrowserStore } from '../../../store/browser/browserStore';
import { logger } from '../../../services/logger';

interface UseBrowserWebviewOptions {
  id: string;
  url: string;
  onWebviewReady?: (id: string, webview: HTMLWebViewElement | null) => void;
}

/**
 * Hook to manage webview lifecycle and events
 * Handles webview ref, event listeners, and state updates
 */
export function useBrowserWebview({ id, url, onWebviewReady }: UseBrowserWebviewOptions) {
  const webviewRef = useRef<HTMLWebViewElement | null>(null);
  const updateTabTitle = useBrowserStore((state) => state.actions.updateTabTitle);
  const updateTabUrl = useBrowserStore((state) => state.actions.updateTabUrl);

  const setWebviewRef = useCallback(
    (node: HTMLWebViewElement | null) => {
      webviewRef.current = node;
      if (onWebviewReady) {
        onWebviewReady(id, node);
      }
    },
    [id, onWebviewReady]
  );

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleTitleUpdated = () => {
      const title = webview.getTitle();
      logger.debug(`Browser title updated: ${title}`, 'Browser');
      updateTabTitle(id, title || 'Untitled');
    };

    const handleDidNavigate = (e: Event) => {
      const navEvent = e as unknown as { url: string };
      logger.debug(`Browser navigated to: ${navEvent.url}`, 'Browser');
      updateTabUrl(id, navEvent.url || url);
    };

    const handleDomReady = () => {
      logger.debug('Browser DOM ready', 'Browser');
      const title = webview.getTitle();
      if (title) {
        updateTabTitle(id, title);
      }
    };

    const handleDidFailLoad = (e: Event) => {
      const errorEvent = e as unknown as { errorDescription: string; errorCode: number };
      logger.warn(`Browser failed to load: ${errorEvent.errorDescription} (${errorEvent.errorCode})`, 'Browser');
    };

    webview.addEventListener('page-title-updated', handleTitleUpdated);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleDidFailLoad);

    return () => {
      webview.removeEventListener('page-title-updated', handleTitleUpdated);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, [id, url, updateTabTitle, updateTabUrl]);

  return {
    setWebviewRef,
  };
}
