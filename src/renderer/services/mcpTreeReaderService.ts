import type { TreeReadRequest, TreeReadResponse } from '../../shared/types/electronApi';
import { logger } from './logger';
import { findStoreOwningSession } from '../store/storeOwnership';

function findStateForNode(sessionId: string, nodeId: string): TreeReadResponse['state'] {
  const store = findStoreOwningSession(sessionId);
  if (!store) return null;
  const state = store.getState();
  if (!state.nodes[nodeId]) return null;
  return {
    nodes: state.nodes,
    rootNodeId: state.rootNodeId,
    ancestorRegistry: state.ancestorRegistry,
  };
}

export function startMcpTreeReaderService(): () => void {
  return window.electron.onMcpTreeReadRequest((request: TreeReadRequest) => {
    const state = findStateForNode(request.sessionId, request.nodeId);
    if (!state) {
      logger.warn(
        `tree-read: node ${request.nodeId} not resolvable in the file bound to session ${request.sessionId}`,
        'McpTreeReader',
      );
    }
    void window.electron.respondToMcpTreeRead({ requestId: request.requestId, state });
  });
}
