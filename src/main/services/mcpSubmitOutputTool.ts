import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeReader, TreeReadState, ToolResult } from './mcpReadTools';
import { OneShotTargetStore } from './oneShotTargetStore';
import { ProposalSubmitter } from './mcpProposalBridge';

export interface StepOutputApplier {
  apply(
    boundNodeId: string,
    content: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface SubmitOutputToolDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  treeReader: TreeReader;
  applier: StepOutputApplier;
  oneShotTargetStore: OneShotTargetStore;
  proposalSubmitter: ProposalSubmitter;
}

export type SubmitOutputOrigin = 'explicit' | 'safety-net';

export interface SubmitOutputTool {
  submitStepOutput(args: { sessionId: string; content: string; origin?: SubmitOutputOrigin }): Promise<ToolResult>;
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function isAutomatic(nodeId: string, state: TreeReadState): boolean {
  // Workflow execution binds the working node, not the parent step that carries stepType.
  if (state.nodes[nodeId]?.metadata.stepType === 'autonomous') return true;
  const ancestors = state.ancestorRegistry[nodeId] ?? [];
  const parentId = ancestors[ancestors.length - 1];
  return !!parentId && state.nodes[parentId]?.metadata.stepType === 'autonomous';
}

export function createSubmitOutputTool(deps: SubmitOutputToolDeps): SubmitOutputTool {
  return {
    submitStepOutput: async ({ sessionId, content, origin = 'explicit' }) => {
      if (origin === 'safety-net' && !deps.oneShotTargetStore.wasMarkerSeenThisTurn(sessionId)) {
        return ok({ applied: false, reason: 'safety-net skipped — no marker this turn (action mode or foreign)' });
      }

      const pendingTarget = deps.oneShotTargetStore.pendingTarget(sessionId);
      const boundNodeId = pendingTarget ?? deps.bindingRegistry.lookup(sessionId);
      if (!boundNodeId) {
        return ok({ applied: false, reason: 'unbound — session has no binding' });
      }

      const state = await deps.treeReader.readState(boundNodeId);
      if (!state) {
        return err('Tree state is unavailable. The renderer may not be ready or no file is open.');
      }
      if (!state.nodes[boundNodeId]) {
        return err(`Bound node ${boundNodeId} not found in the tree (orphan binding).`);
      }

      if (!isAutomatic(boundNodeId, state)) {
        if (origin === 'safety-net') {
          return ok({ applied: false, reason: 'safety-net skipped non-automatic step' });
        }
        const proposal = await deps.proposalSubmitter.submit({
          sessionId,
          nodeId: boundNodeId,
          request: { kind: 'submit-step-output', content },
        });
        if (!proposal.ok) return err(proposal.error);
        deps.oneShotTargetStore.clearPendingTarget(sessionId);
        return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
      }

      const result = await deps.applier.apply(boundNodeId, content);
      if (!result.ok) {
        return err(result.error);
      }

      deps.oneShotTargetStore.clearPendingTarget(sessionId);
      return ok({ applied: true });
    },
  };
}
