import { useBrowserStore } from '../../store/browser/browserStore';
import { Browser } from './Browser';
import { Tab } from '../Tab';
import { useBrowserWebviewRefs } from './hooks/useBrowserWebviewRefs';
import { useBrowserNavigation } from './hooks/useBrowserNavigation';
import { useBrowserAddressBar } from './hooks/useBrowserAddressBar';
import { useBrowserTabManagement } from './hooks/useBrowserTabManagement';
import { useBrowserNavigationSync } from './hooks/useBrowserNavigationSync';
import './BrowserPanel.css';

export function BrowserPanel() {
  const { tabs, activeTabId, panelPosition, actions } = useBrowserStore();

  // Manage webview references
  const { registerWebview, getActiveWebview, unregisterWebview } = useBrowserWebviewRefs(activeTabId);

  // Manage navigation state
  const { canGoBack, canGoForward, updateNavigationState, handleBack, handleForward, handleReload } =
    useBrowserNavigation({ getActiveWebview });

  // Manage address bar state
  const {
    addressBarValue,
    setAddressBarValue,
    setIsEditingAddress,
    handleAddressBarSubmit,
    updateAddressBarFromWebview,
  } = useBrowserAddressBar({ activeTabId, tabs, getActiveWebview });

  // Manage tab operations
  const { handleNewBrowser, handleCloseBrowser } = useBrowserTabManagement({ unregisterWebview });

  // Sync navigation state with webview events
  useBrowserNavigationSync({ activeTabId, getActiveWebview, updateNavigationState, updateAddressBarFromWebview });

  return (
    <div className="browser-panel">
      <div className="browser-tab-bar">
        <div className="browser-tabs-left">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              displayName={tab.title}
              isActive={activeTabId === tab.id}
              onClick={() => actions.setActiveTab(tab.id)}
              onClose={() => handleCloseBrowser(tab.id)}
            />
          ))}
          <button onClick={handleNewBrowser} className="new-browser-button" title="New Tab">
            +
          </button>
        </div>
        <button
          onClick={actions.togglePanelPosition}
          className="toggle-panel-button"
          title={`Switch to ${panelPosition === 'side' ? 'bottom' : 'side'} panel`}
        >
          {panelPosition === 'side' ? '⬇' : '➡'}
        </button>
      </div>

      <div className="browser-nav-bar">
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className="browser-nav-button"
          title="Back"
        >
          ←
        </button>
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className="browser-nav-button"
          title="Forward"
        >
          →
        </button>
        <button onClick={handleReload} className="browser-nav-button" title="Reload">
          ↻
        </button>
        <form onSubmit={handleAddressBarSubmit} className="browser-nav-form">
          <input
            type="text"
            className="browser-url-display"
            value={addressBarValue}
            onFocus={() => setIsEditingAddress(true)}
            onBlur={() => setIsEditingAddress(false)}
            onChange={(e) => setAddressBarValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddressBarSubmit();
              }
            }}
            placeholder="Enter URL..."
          />
        </form>
      </div>

      <div className="browser-content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`browser-wrapper ${activeTabId !== tab.id ? 'hidden' : ''}`}
          >
            <Browser id={tab.id} url={tab.url} onWebviewReady={registerWebview} />
          </div>
        ))}
      </div>
    </div>
  );
}
