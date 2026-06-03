import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import { TreeReader, TreeReadResult } from './mcpReadTools';

export const TREE_READ_REQUEST_CHANNEL = 'mcp:tree-read-request';
export const TREE_READ_RESPONSE_CHANNEL = 'mcp:tree-read-response';

export interface TreeReadRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
}

export interface TreeReadResponse {
  requestId: string;
  state: TreeReadResult;
}

export interface McpTreeReaderBridgeDeps {
  sendToRenderer: (channel: string, payload: TreeReadRequest) => void;
  onRendererResponse: (handler: (response: TreeReadResponse) => void) => () => void;
  timeoutMs: number;
}

export interface McpTreeReaderBridge extends TreeReader {
  dispose(): void;
}

// not-ready originates here and only here: the renderer never responded
// (timeout) or the bridge is going away (dispose). The renderer produces the
// other variants and they are forwarded untouched.
const NOT_READY: TreeReadResult = { kind: 'not-ready' };

export function createMcpTreeReaderBridge(
  deps: McpTreeReaderBridgeDeps,
): McpTreeReaderBridge {
  const pending = new Map<string, (result: TreeReadResult) => void>();

  const unsubscribe = deps.onRendererResponse((response) => {
    const resolver = pending.get(response.requestId);
    if (!resolver) return;
    pending.delete(response.requestId);
    resolver(response.state);
  });

  async function readState(sessionId: string, boundNodeId: string): Promise<TreeReadResult> {
    if (!boundNodeId) return { kind: 'node-not-in-open-store' };
    const requestId = randomUUID();
    return new Promise<TreeReadResult>((resolve) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          logger.warn(
            `tree-read for node ${boundNodeId} timed out after ${deps.timeoutMs}ms`,
            'McpTreeReaderBridge',
          );
          resolve(NOT_READY);
        }
      }, deps.timeoutMs);

      pending.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      deps.sendToRenderer(TREE_READ_REQUEST_CHANNEL, { requestId, sessionId, nodeId: boundNodeId });
    });
  }

  return {
    readState,
    dispose() {
      unsubscribe();
      for (const resolver of pending.values()) resolver(NOT_READY);
      pending.clear();
    },
  };
}
