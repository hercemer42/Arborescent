import { useBrowserWebview } from './hooks/useBrowserWebview';
import './Browser.css';

interface BrowserProps {
  id: string;
  url: string;
  onWebviewReady?: (id: string, webview: HTMLWebViewElement | null) => void;
}

export function Browser({ id, url, onWebviewReady }: BrowserProps) {
  const { setWebviewRef } = useBrowserWebview({ id, url, onWebviewReady });

  return (
    <div className="browser-container">
      <webview
        ref={setWebviewRef}
        src={url}
        className="browser-webview"
        partition="persist:browser"
      />
    </div>
  );
}
