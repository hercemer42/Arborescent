import { useRef } from 'react';
import { useBrowserWebview } from './hooks/useBrowserWebview';
import './Browser.css';

interface BrowserProps {
  id: string;
  initialUrl: string;
  onWebviewReady?: (id: string, webview: HTMLWebViewElement | null) => void;
}

export function Browser({ id, initialUrl, onWebviewReady }: BrowserProps) {
  // Ref prevents src attribute changes which trigger Electron error logging
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
