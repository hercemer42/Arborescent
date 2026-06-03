import type { TreeReadRequest, TreeReadResponse } from '../../shared/types/electronApi';
import { logger } from './logger';
import { findStoreOwningSession } from '../store/storeOwnership';

// node-not-in-open-store covers both a deleted node and a node living in a
// different file: only the session's owning store is consulted, never the
// other open files, so the two are indistinguishable here by design.
function readNodeFromOwningStore(sessionId: string, nodeId: string): TreeReadResponse['state'] {
  const store = findStoreOwningSession(sessionId);
  if (!store) return { kind: 'no-session-store' };
  const state = store.getState();
  if (!state.nodes[nodeId]) return { kind: 'node-not-in-open-store' };
  return {
    kind: 'ok',
    state: {
      nodes: state.nodes,
      rootNodeId: state.rootNodeId,
      ancestorRegistry: state.ancestorRegistry,
    },
  };
}

export function startMcpTreeReaderService(): () => void {
  return window.electron.onMcpTreeReadRequest((request: TreeReadRequest) => {
    const result = readNodeFromOwningStore(request.sessionId, request.nodeId);
    if (result.kind !== 'ok') {
      logger.warn(
        `tree-read ${result.kind}: node ${request.nodeId} not resolvable for session ${request.sessionId}`,
        'McpTreeReader',
      );
    }
    void window.electron.respondToMcpTreeRead({ requestId: request.requestId, state: result });
  });
}
