import { Browser } from '../Browser';
import { BrowserTab } from '../../../../shared/interfaces';
import './BrowserContent.css';

interface BrowserContentProps {
  tabs: BrowserTab[];
  activeTabId: string | null;
  onWebviewReady: (id: string, webview: HTMLWebViewElement | null) => void;
}

export function BrowserContent({ tabs, activeTabId, onWebviewReady }: BrowserContentProps) {
  return (
    <div className="browser-content">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`browser-wrapper ${activeTabId !== tab.id ? 'hidden' : ''}`}
        >
          <Browser id={tab.id} url={tab.url} onWebviewReady={onWebviewReady} />
        </div>
      ))}
    </div>
  );
}
