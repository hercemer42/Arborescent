import type { TreeReadRequest, TreeReadResponse } from '../../shared/types/electronApi';
import { logger } from './logger';
import { storeManager } from '../store/storeManager';

function findStateForNode(nodeId: string): TreeReadResponse['state'] {
  for (const store of storeManager.getAllStores()) {
    const state = store.getState();
    if (state.nodes[nodeId]) {
      return {
        nodes: state.nodes,
        rootNodeId: state.rootNodeId,
        ancestorRegistry: state.ancestorRegistry,
      };
    }
  }
  return null;
}

export function startMcpTreeReaderService(): () => void {
  return window.electron.onMcpTreeReadRequest((request: TreeReadRequest) => {
    const state = findStateForNode(request.nodeId);
    if (!state) {
      logger.warn(`tree-read: node ${request.nodeId} not found in any open store`, 'McpTreeReader');
    }
    void window.electron.respondToMcpTreeRead({ requestId: request.requestId, state });
  });
}
