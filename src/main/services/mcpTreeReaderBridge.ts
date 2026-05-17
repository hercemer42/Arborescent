import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import { TreeReader, TreeReadState } from './mcpReadTools';

export const TREE_READ_REQUEST_CHANNEL = 'mcp:tree-read-request';
export const TREE_READ_RESPONSE_CHANNEL = 'mcp:tree-read-response';

export interface TreeReadRequest {
  requestId: string;
  nodeId: string;
}

export interface TreeReadResponse {
  requestId: string;
  state: TreeReadState | null;
}

export interface McpTreeReaderBridgeDeps {
  sendToRenderer: (channel: string, payload: TreeReadRequest) => void;
  onRendererResponse: (handler: (response: TreeReadResponse) => void) => () => void;
  timeoutMs: number;
}

export interface McpTreeReaderBridge extends TreeReader {
  dispose(): void;
}

export function createMcpTreeReaderBridge(
  deps: McpTreeReaderBridgeDeps,
): McpTreeReaderBridge {
  const pending = new Map<string, (state: TreeReadState | null) => void>();

  const unsubscribe = deps.onRendererResponse((response) => {
    const resolver = pending.get(response.requestId);
    if (!resolver) return;
    pending.delete(response.requestId);
    resolver(response.state);
  });

  async function readState(boundNodeId: string): Promise<TreeReadState | null> {
    if (!boundNodeId) return null;
    const requestId = randomUUID();
    return new Promise<TreeReadState | null>((resolve) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          logger.warn(
            `tree-read for node ${boundNodeId} timed out after ${deps.timeoutMs}ms`,
            'McpTreeReaderBridge',
          );
          resolve(null);
        }
      }, deps.timeoutMs);

      pending.set(requestId, (state) => {
        clearTimeout(timer);
        resolve(state);
      });

      deps.sendToRenderer(TREE_READ_REQUEST_CHANNEL, { requestId, nodeId: boundNodeId });
    });
  }

  return {
    readState,
    dispose() {
      unsubscribe();
      for (const resolver of pending.values()) resolver(null);
      pending.clear();
    },
  };
}
