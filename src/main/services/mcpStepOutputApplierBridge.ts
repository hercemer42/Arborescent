import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import { StepOutputApplier } from './mcpSubmitOutputTool';

export const STEP_OUTPUT_APPLY_REQUEST_CHANNEL = 'mcp:step-output-apply-request';

export interface StepOutputApplyRequest {
  requestId: string;
  sessionId: string;
  nodeId: string;
  content: string;
}

export interface StepOutputApplyResponse {
  requestId: string;
  result: { ok: true } | { ok: false; error: string };
}

export interface McpStepOutputApplierBridgeDeps {
  sendToRenderer: (channel: string, payload: StepOutputApplyRequest) => void;
  onRendererResponse: (
    handler: (response: StepOutputApplyResponse) => void,
  ) => () => void;
  timeoutMs: number;
}

export interface McpStepOutputApplierBridge extends StepOutputApplier {
  dispose(): void;
}

export function createMcpStepOutputApplierBridge(
  deps: McpStepOutputApplierBridgeDeps,
): McpStepOutputApplierBridge {
  const pending = new Map<string, (result: { ok: true } | { ok: false; error: string }) => void>();

  const unsubscribe = deps.onRendererResponse((response) => {
    const resolver = pending.get(response.requestId);
    if (!resolver) return;
    pending.delete(response.requestId);
    resolver(response.result);
  });

  async function apply(
    sessionId: string,
    boundNodeId: string,
    content: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!boundNodeId) {
      return { ok: false, error: 'No bound node id provided' };
    }
    const requestId = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          logger.warn(
            `step-output apply for node ${boundNodeId} timed out after ${deps.timeoutMs}ms`,
            'McpStepOutputApplierBridge',
          );
          resolve({ ok: false, error: `Apply timed out after ${deps.timeoutMs}ms` });
        }
      }, deps.timeoutMs);

      pending.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      deps.sendToRenderer(STEP_OUTPUT_APPLY_REQUEST_CHANNEL, {
        requestId,
        sessionId,
        nodeId: boundNodeId,
        content,
      });
    });
  }

  return {
    apply,
    dispose() {
      unsubscribe();
      for (const resolver of pending.values()) {
        resolver({ ok: false, error: 'Bridge disposed before response arrived' });
      }
      pending.clear();
    },
  };
}
