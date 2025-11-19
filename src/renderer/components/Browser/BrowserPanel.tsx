import { useBrowserStore } from '../../store/browser/browserStore';
import { BrowserTabBar } from './BrowserTabBar';
import { BrowserNavBar } from './BrowserNavBar';
import { BrowserContent } from './BrowserContent';
import { useBrowserWebviewRefs } from './hooks/useBrowserWebviewRefs';
import { useBrowserNavigation } from './BrowserNavBar/hooks/useBrowserNavigation';
import { useBrowserAddressBar } from './BrowserNavBar/hooks/useBrowserAddressBar';
import { useBrowserTabManagement } from './BrowserTabBar/hooks/useBrowserTabManagement';
import { useBrowserNavigationSync } from './BrowserNavBar/hooks/useBrowserNavigationSync';
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
      <BrowserTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        panelPosition={panelPosition}
        onTabClick={actions.setActiveTab}
        onTabClose={handleCloseBrowser}
        onNewTab={handleNewBrowser}
        onTogglePanelPosition={actions.togglePanelPosition}
      />
      <BrowserNavBar
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        addressBarValue={addressBarValue}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onAddressBarChange={setAddressBarValue}
        onAddressBarSubmit={handleAddressBarSubmit}
        onAddressBarFocus={() => setIsEditingAddress(true)}
        onAddressBarBlur={() => setIsEditingAddress(false)}
      />
      <BrowserContent
        tabs={tabs}
        activeTabId={activeTabId}
        onWebviewReady={registerWebview}
      />
    </div>
  );
}
