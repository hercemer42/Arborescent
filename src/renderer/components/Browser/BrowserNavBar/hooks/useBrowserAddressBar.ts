import { useState, useCallback, useMemo } from 'react';
import { BrowserTab } from '../../../../store/browser/browserStore';
import { normalizeUrl } from '../../../../utils/urlHelpers';

interface UseBrowserAddressBarOptions {
  activeTabId: string | null;
  tabs: BrowserTab[];
  getActiveWebview: () => HTMLWebViewElement | null;
}

export function useBrowserAddressBar({ activeTabId, tabs, getActiveWebview }: UseBrowserAddressBarOptions) {
  const [editingValue, setEditingValue] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const activeTabUrl = useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    return activeTab?.url ?? '';
  }, [activeTabId, tabs]);

  const addressBarValue = isEditingAddress ? editingValue : activeTabUrl;

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
          setEditingValue(webview.getURL());
        } catch {
          // Webview not ready yet
        }
      }
    }
  }, [isEditingAddress, getActiveWebview]);

  return {
    addressBarValue,
    setAddressBarValue: setEditingValue,
    isEditingAddress,
    setIsEditingAddress,
    handleAddressBarSubmit,
    updateAddressBarFromWebview,
  };
}
