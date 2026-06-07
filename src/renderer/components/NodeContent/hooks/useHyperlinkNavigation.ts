import { useCallback } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';
import { useToastStore } from '../../../store/toast/toastStore';
import { useBrowserStore } from '../../../store/browser/browserStore';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useNodeNavigation } from '../../../hooks/useNodeNavigation';

export function useHyperlinkNavigation(node: TreeNode) {
  const store = useActiveTreeStore();
  const { navigateToNode } = useNodeNavigation();
  const addBrowserTab = useBrowserStore((state) => state.actions.addTab);
  const showBrowser = usePanelStore((state) => state.showBrowser);

  const isExternalLink = node.metadata.isExternalLink === true;
  const externalUrl = node.metadata.externalUrl as string | undefined;

  const openInExternalBrowser = useCallback(() => {
    if (!externalUrl) return;
    window.electron.openExternal(externalUrl).catch(() => {
      useToastStore.getState().addToast('Failed to open link', 'error');
    });
  }, [externalUrl]);

  const navigateToLinkedNode = useCallback(() => {
    if (isExternalLink && externalUrl) {
      addBrowserTab(externalUrl);
      showBrowser();
      return;
    }

    const linkedNodeId = node.metadata.linkedNodeId as string | undefined;
    if (!linkedNodeId) return;

    if (!store.getState().nodes[linkedNodeId]) {
      useToastStore.getState().addToast('Linked branch not found', 'error');
      return;
    }

    navigateToNode(linkedNodeId);
  }, [node.metadata.linkedNodeId, store, navigateToNode, isExternalLink, externalUrl, addBrowserTab, showBrowser]);

  return { navigateToLinkedNode, isExternalLink, openInExternalBrowser };
}
