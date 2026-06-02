import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import { TreeMutator, MutationRequest, MutationResult } from './mcpWriteTools';

export const TREE_MUTATE_REQUEST_CHANNEL = 'mcp:tree-mutate-request';

export interface TreeMutateRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
  request: MutationRequest;
}

export interface TreeMutateResponse {
  requestId: string;
  result: MutationResult;
}

export interface McpTreeMutatorBridgeDeps {
  sendToRenderer: (channel: string, payload: TreeMutateRequest) => void;
  onRendererResponse: (handler: (response: TreeMutateResponse) => void) => () => void;
  timeoutMs: number;
}

export interface McpTreeMutatorBridge extends TreeMutator {
  dispose(): void;
}

export function createMcpTreeMutatorBridge(
  deps: McpTreeMutatorBridgeDeps,
): McpTreeMutatorBridge {
  const pending = new Map<string, (result: MutationResult) => void>();

  const unsubscribe = deps.onRendererResponse((response) => {
    const resolver = pending.get(response.requestId);
    if (!resolver) return;
    pending.delete(response.requestId);
    resolver(response.result);
  });

  async function mutate(sessionId: string, boundNodeId: string, request: MutationRequest): Promise<MutationResult> {
    if (!boundNodeId) {
      return { ok: false, error: 'No bound node id provided' };
    }
    const requestId = randomUUID();
    return new Promise<MutationResult>((resolve) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          logger.warn(
            `tree-mutate for node ${boundNodeId} timed out after ${deps.timeoutMs}ms`,
            'McpTreeMutatorBridge',
          );
          resolve({ ok: false, error: `Mutation timed out after ${deps.timeoutMs}ms` });
        }
      }, deps.timeoutMs);

      pending.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      deps.sendToRenderer(TREE_MUTATE_REQUEST_CHANNEL, { requestId, sessionId, nodeId: boundNodeId, request });
    });
  }

  return {
    mutate,
    dispose() {
      unsubscribe();
      for (const resolver of pending.values()) {
        resolver({ ok: false, error: 'Bridge disposed before response arrived' });
      }
      pending.clear();
    },
  };
}
