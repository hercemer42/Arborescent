import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeReader, TreeReadState, ToolResult } from './mcpReadTools';
import { SubmitMarker } from './submitMarker';
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
  marker: SubmitMarker;
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
  return state.nodes[nodeId]?.metadata.stepType === 'autonomous';
}

export function createSubmitOutputTool(deps: SubmitOutputToolDeps): SubmitOutputTool {
  return {
    submitStepOutput: async ({ sessionId, content, origin = 'explicit' }) => {
      const boundNodeId = deps.bindingRegistry.lookup(sessionId);
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

      if (deps.marker.hasSubmitted(sessionId)) {
        return ok({ applied: false, reason: 'already submitted this turn (deduped)' });
      }

      if (!isAutomatic(boundNodeId, state)) {
        // Safety-net invocations are speculative captures of the last assistant
        // message — for non-automatic steps the user is in the loop and will
        // submit explicitly. Manufacturing a proposal per turn would pile up
        // entries the user did not ask Claude to send.
        if (origin === 'safety-net') {
          return ok({ applied: false, reason: 'safety-net skipped non-automatic step' });
        }
        const proposal = await deps.proposalSubmitter.submit({
          sessionId,
          nodeId: boundNodeId,
          request: { kind: 'submit-step-output', content },
        });
        if (!proposal.ok) return err(proposal.error);
        deps.marker.markSubmitted(sessionId);
        return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
      }

      const result = await deps.applier.apply(boundNodeId, content);
      if (!result.ok) {
        return err(result.error);
      }

      deps.marker.markSubmitted(sessionId);
      return ok({ applied: true });
    },
  };
}
