import { useRef } from 'react';
import { useBrowserWebview } from './hooks/useBrowserWebview';
import './Browser.css';

interface BrowserProps {
  id: string;
  initialUrl: string;
  onWebviewReady?: (id: string, webview: HTMLWebViewElement | null) => void;
}

/**
 * Browser component that renders a webview.
 * Note: Only uses initialUrl to set the initial src attribute.
 * All subsequent URL changes should be done via webview.loadURL() to avoid
 * Electron's internal error logging when src attribute changes.
 */
export function Browser({ id, initialUrl, onWebviewReady }: BrowserProps) {
  // Store initial URL in ref to prevent re-renders from changing src
  const initialUrlRef = useRef(initialUrl);
  const { setWebviewRef } = useBrowserWebview({ id, url: initialUrl, onWebviewReady });

  return (
    <div className="browser-container">
      <webview
        ref={setWebviewRef}
        src={initialUrlRef.current}
        className="browser-webview"
        partition="persist:browser"
      />
    </div>
  );
}
