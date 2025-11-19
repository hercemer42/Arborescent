import { useCallback } from 'react';
import { useBrowserStore } from '../../../store/browser/browserStore';

interface UseBrowserTabManagementOptions {
  unregisterWebview: (id: string) => void;
}

/**
 * Hook to manage browser tab operations
 * Handles creating and closing tabs
 */
export function useBrowserTabManagement({ unregisterWebview }: UseBrowserTabManagementOptions) {
  const actions = useBrowserStore((state) => state.actions);

  const handleNewBrowser = useCallback(() => {
    actions.addTab('https://ecosia.org');
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
