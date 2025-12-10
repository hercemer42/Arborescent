import { useState, useCallback, useEffect } from 'react';
import { BrowserTab } from '../../../../store/browser/browserStore';
import { normalizeUrl } from '../../../../utils/urlHelpers';

interface UseBrowserAddressBarOptions {
  activeTabId: string | null;
  tabs: BrowserTab[];
  getActiveWebview: () => HTMLWebViewElement | null;
}

export function useBrowserAddressBar({ activeTabId, tabs, getActiveWebview }: UseBrowserAddressBarOptions) {
  const [addressBarValue, setAddressBarValue] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const handleAddressBarSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const webview = getActiveWebview();
    if (webview && addressBarValue) {
      const url = normalizeUrl(addressBarValue);
      // Electron types don't reflect that loadURL returns a Promise
      (webview.loadURL(url) as unknown as Promise<void>).catch(() => {});
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
