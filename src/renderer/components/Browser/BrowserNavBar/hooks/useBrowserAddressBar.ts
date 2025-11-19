import { useState, useCallback, useEffect } from 'react';
import { BrowserTab } from '../../../../store/browser/browserStore';

interface UseBrowserAddressBarOptions {
  activeTabId: string | null;
  tabs: BrowserTab[];
  getActiveWebview: () => HTMLWebViewElement | null;
}

/**
 * Hook to manage browser address bar state and submission
 * Handles URL input, editing state, and navigation
 */
export function useBrowserAddressBar({ activeTabId, tabs, getActiveWebview }: UseBrowserAddressBarOptions) {
  const [addressBarValue, setAddressBarValue] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const handleAddressBarSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const webview = getActiveWebview();
    if (webview && addressBarValue) {
      let url = addressBarValue;
      // Add https:// if no protocol specified
      if (!url.match(/^[a-zA-Z]+:\/\//)) {
        url = 'https://' + url;
      }
      webview.loadURL(url);
      setIsEditingAddress(false);
    }
  }, [addressBarValue, getActiveWebview]);

  const updateAddressBarFromWebview = useCallback(() => {
    if (!isEditingAddress) {
      const webview = getActiveWebview();
      if (webview) {
        try {
          setAddressBarValue(webview.getURL());
        } catch {
          // Webview not ready yet
        }
      }
    }
  }, [isEditingAddress, getActiveWebview]);

  // Update address bar when active tab changes
  useEffect(() => {
    if (!isEditingAddress) {
      const activeTab = tabs.find((tab) => tab.id === activeTabId);
      if (activeTab) {
        setAddressBarValue(activeTab.url);
      }
    }
  }, [activeTabId, tabs, isEditingAddress]);

  return {
    addressBarValue,
    setAddressBarValue,
    isEditingAddress,
    setIsEditingAddress,
    handleAddressBarSubmit,
    updateAddressBarFromWebview,
  };
}
