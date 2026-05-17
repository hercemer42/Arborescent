import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import type { MutationRequest } from './mcpWriteTools';

export const PROPOSAL_REQUEST_CHANNEL = 'mcp:proposal-request';

export type ProposalPayload =
  | MutationRequest
  | { kind: 'submit-step-output'; content: string };

export interface ProposalSubmissionArgs {
  sessionId: string;
  nodeId: string;
  request: ProposalPayload;
}

export interface ProposalRequest extends ProposalSubmissionArgs {
  requestId: string;
}

export type ProposalResult = { ok: true; proposalId: string } | { ok: false; error: string };

export interface ProposalResponse {
  requestId: string;
  result: ProposalResult;
}

export interface ProposalSubmitter {
  submit(args: ProposalSubmissionArgs): Promise<ProposalResult>;
}

export interface McpProposalBridgeDeps {
  sendToRenderer: (channel: string, payload: ProposalRequest) => void;
  onRendererResponse: (handler: (response: ProposalResponse) => void) => () => void;
  timeoutMs: number;
}

export interface McpProposalBridge extends ProposalSubmitter {
  dispose(): void;
}

export function createMcpProposalBridge(deps: McpProposalBridgeDeps): McpProposalBridge {
  const pending = new Map<string, (result: ProposalResult) => void>();

  const unsubscribe = deps.onRendererResponse((response) => {
    const resolver = pending.get(response.requestId);
    if (!resolver) return;
    pending.delete(response.requestId);
    resolver(response.result);
  });

  async function submit(args: ProposalSubmissionArgs): Promise<ProposalResult> {
    if (!args.sessionId) return { ok: false, error: 'No session id provided' };
    if (!args.nodeId) return { ok: false, error: 'No node id provided' };

    const requestId = randomUUID();
    return new Promise<ProposalResult>((resolve) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          logger.warn(
            `proposal submission for session ${args.sessionId} timed out after ${deps.timeoutMs}ms`,
            'McpProposalBridge',
          );
          resolve({ ok: false, error: `Proposal submission timed out after ${deps.timeoutMs}ms` });
        }
      }, deps.timeoutMs);

      pending.set(requestId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      deps.sendToRenderer(PROPOSAL_REQUEST_CHANNEL, { requestId, ...args });
    });
  }

  return {
    submit,
    dispose() {
      unsubscribe();
      for (const resolver of pending.values()) {
        resolver({ ok: false, error: 'Bridge disposed before response arrived' });
      }
      pending.clear();
    },
  };
}
