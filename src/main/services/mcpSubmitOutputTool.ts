import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeReader, ToolResult } from './mcpReadTools';
import { OneShotTargetStore } from './oneShotTargetStore';
import { ProposalSubmitter } from './mcpProposalBridge';
import { logger } from './logger';
import { isStructurallyAutonomous } from '../../shared/utils/autonomousStepContext';

export interface StepOutputApplier {
  apply(
    sessionId: string,
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
  submitStepOutput(args: {
    sessionId: string;
    content: string;
    targetNodeId?: string;
    origin?: SubmitOutputOrigin;
  }): Promise<ToolResult>;
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function createSubmitOutputTool(deps: SubmitOutputToolDeps): SubmitOutputTool {
  return {
    submitStepOutput: async ({ sessionId, content, targetNodeId, origin = 'explicit' }) => {
      if (origin === 'safety-net') {
        // Completion requires an explicit submit_step_output call from the AI;
        // the Stop-hook safety net no longer auto-applies content. A turn that
        // ended without an explicit submit must not advance the bound step.
        logger.info(`submit_step_output session=${sessionId} origin=safety-net applied=false reason=no-op`, 'McpSubmit');
        return ok({ applied: false, reason: 'safety-net no-op — explicit submit_step_output required for completion' });
      }

      const pendingTarget = deps.oneShotTargetStore.pendingTarget(sessionId);
      const boundNodeId = pendingTarget ?? deps.bindingRegistry.lookup(sessionId);
      if (!boundNodeId) {
        logger.info(`submit_step_output session=${sessionId} origin=explicit applied=false reason=unbound`, 'McpSubmit');
        return ok({ applied: false, reason: 'unbound — session has no binding' });
      }

      const state = await deps.treeReader.readState(sessionId, boundNodeId);
      if (!state) {
        return err('Tree state is unavailable. The renderer may not be ready or no file is open.');
      }
      if (!state.nodes[boundNodeId]) {
        return err(`Bound node ${boundNodeId} not found in the tree (orphan binding).`);
      }

      if (!isStructurallyAutonomous(boundNodeId, state)) {
        if (targetNodeId && targetNodeId !== boundNodeId) {
          logger.warn(
            `gate-miss gate=4 session=${sessionId} tokenTarget=${targetNodeId} resolvedTarget=${boundNodeId} reason=drift-proposal-route`,
            'McpSubmit',
          );
          return err(
            `submit_step_output target drift — token target ${targetNodeId} does not match resolved bound node ${boundNodeId}`,
          );
        }
        const proposal = await deps.proposalSubmitter.submit({
          sessionId,
          nodeId: boundNodeId,
          request: { kind: 'submit-step-output', content },
        });
        if (!proposal.ok) return err(proposal.error);
        deps.oneShotTargetStore.setExplicitSubmitSeenThisTurn(sessionId, true);
        logger.info(`submit_step_output session=${sessionId} origin=explicit applied=false proposed=true node=${boundNodeId}`, 'McpSubmit');
        return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
      }

      // Gate 4: target-keyed token check. Required on the autonomous route to
      // catch binding drift between prompt-render and submit (workflow
      // advance, user-confirmed in-flight rebind, decomposition+recurse race).
      if (!targetNodeId) {
        logger.warn(
          `gate-miss gate=4 session=${sessionId} node=${boundNodeId} reason=missing-token`,
          'McpSubmit',
        );
        return err(
          `submit_step_output requires target_node_id on the autonomous route — expected ${boundNodeId}`,
        );
      }
      if (targetNodeId !== boundNodeId) {
        logger.warn(
          `gate-miss gate=4 session=${sessionId} tokenTarget=${targetNodeId} resolvedTarget=${boundNodeId} reason=drift`,
          'McpSubmit',
        );
        return err(
          `submit_step_output target drift — token target ${targetNodeId} does not match resolved bound node ${boundNodeId}`,
        );
      }

      const result = await deps.applier.apply(sessionId, boundNodeId, content);
      if (!result.ok) {
        return err(result.error);
      }

      deps.oneShotTargetStore.setExplicitSubmitSeenThisTurn(sessionId, true);
      logger.info(`submit_step_output session=${sessionId} origin=explicit applied=true node=${boundNodeId}`, 'McpSubmit');
      return ok({ applied: true });
    },
  };
}
