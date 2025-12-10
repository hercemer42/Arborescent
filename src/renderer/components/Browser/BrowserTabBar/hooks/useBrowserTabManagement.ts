import { useCallback } from 'react';
import { useBrowserStore, DEFAULT_BROWSER_URL } from '../../../../store/browser/browserStore';

interface UseBrowserTabManagementOptions {
  unregisterWebview: (id: string) => void;
}

export function useBrowserTabManagement({ unregisterWebview }: UseBrowserTabManagementOptions) {
  const actions = useBrowserStore((state) => state.actions);

  const handleNewBrowser = useCallback(() => {
    actions.addTab(DEFAULT_BROWSER_URL);
  }, [actions]);

  const handleCloseBrowser = useCallback(
    (id: string) => {
      actions.closeTab(id);
      unregisterWebview(id);
    },
    [actions, unregisterWebview]
  );

  return {
    handleNewBrowser,
    handleCloseBrowser,
  };
}
