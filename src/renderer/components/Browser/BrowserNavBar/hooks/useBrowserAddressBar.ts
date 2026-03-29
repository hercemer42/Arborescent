import { useState, useCallback, useMemo } from 'react';
import { BrowserTab } from '../../../../store/browser/browserStore';
import { normalizeUrl } from '../../../../utils/urlHelpers';
import { logger } from '../../../../services/logger';

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
      (webview.loadURL(url) as unknown as Promise<void>).catch((error) => {
        logger.error('Failed to load URL', error as Error, 'Browser', false);
      });
      setIsEditingAddress(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [addressBarValue, getActiveWebview]);

  const updateAddressBarFromWebview = useCallback(() => {
    if (!isEditingAddress) {
      const webview = getActiveWebview();
      if (webview) {
        try {
          setEditingValue(webview.getURL());
        } catch (error) {
          logger.error('Failed to read webview URL', error as Error, 'Browser', false);
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
