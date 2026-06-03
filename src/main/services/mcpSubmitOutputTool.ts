import { SessionBindingRegistry } from './sessionBindingRegistry';
import { resolveBinding } from './bindingResolution';
import { TreeReader, ToolResult, treeReadFailure, codedErr } from './mcpReadTools';
import { OneShotTargetStore } from './oneShotTargetStore';
import { ProposalSubmitter } from './mcpProposalBridge';
import { logger } from './logger';
import { isStructurallyAutonomous } from '../../shared/utils/autonomousStepContext';
import { MCP_ERROR_CODES, McpErrorCode } from '../../shared/utils/mcpErrorCodes';
import {
  resolveContextFlags,
  getContextDeclarations,
  getAppliedContextIdWithInheritance,
  resolveStepMode,
  MODE_POLICY,
} from '../../shared/utils/permissionGate';

export interface StepOutputApplier {
  apply(
    sessionId: string,
    boundNodeId: string,
    content: string,
  ): Promise<{ ok: true } | { ok: false; error: string; code?: McpErrorCode }>;
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

      const resolved = resolveBinding(
        { bindingRegistry: deps.bindingRegistry, oneShotTargetStore: deps.oneShotTargetStore },
        sessionId,
        { oneShot: true },
      );
      if (!resolved) {
        logger.info(`submit_step_output session=${sessionId} origin=explicit applied=false reason=unbound code=${MCP_ERROR_CODES.writeUnbound}`, 'McpSubmit');
        // The unbound response is success-shaped (applied:false), not an MCP
        // error, so its code rides inside the JSON payload instead of a
        // structured error field.
        return ok({
          applied: false,
          reason:
            'unbound — no target node registered and no workflow binding for this session. If you sent with a target node, its ARBORESCENT_TARGET marker did not reach the prompt (check it was included in the message).',
          code: MCP_ERROR_CODES.writeUnbound,
        });
      }

      const boundNodeId = resolved.nodeId;

      const read = await deps.treeReader.readState(sessionId, boundNodeId);
      if (read.kind !== 'ok') {
        return treeReadFailure(read.kind, sessionId, boundNodeId);
      }
      const state = read.state;

      // Mode gate: submit_step_output is the collaborate completion channel
      // only. One-shot manual sends bypass the gate — they have no workflow
      // step, route to the user-reviewed feedback panel, and must keep
      // working regardless of the target node's context.
      if (resolved.source !== 'one-shot') {
        const contextId = getAppliedContextIdWithInheritance(boundNodeId, state.nodes, state.ancestorRegistry);
        if (!contextId) {
          logger.warn(`submit_step_output session=${sessionId} node=${boundNodeId} refused=no-context code=${MCP_ERROR_CODES.writeNoContext}`, 'McpSubmit');
          return codedErr(
            'No context is applied to the bound step. submit_step_output requires an explicitly applied collaborate context.',
            MCP_ERROR_CODES.writeNoContext,
          );
        }
        const mode = resolveStepMode(resolveContextFlags(contextId, state.nodes, getContextDeclarations(state.nodes)));
        const policy = MODE_POLICY[mode];
        if (policy.completionTool !== 'submit_step_output') {
          logger.warn(`submit_step_output session=${sessionId} node=${boundNodeId} refused=mode mode=${mode} code=${MCP_ERROR_CODES.writeModeRefusal}`, 'McpSubmit');
          return codedErr(
            policy.submitRefusal ?? 'submit_step_output is not permitted for this step mode.',
            MCP_ERROR_CODES.writeModeRefusal,
          );
        }
      }

      // One-shot manual sends always route to the user-reviewed proposal
      // panel, even onto an autonomous target — the rebuilding applier
      // replaces the target's subtree and would destroy children added
      // out-of-band during the turn. Only workflow submits on a structurally
      // autonomous step auto-apply.
      if (resolved.source === 'one-shot' || !isStructurallyAutonomous(boundNodeId, state)) {
        if (targetNodeId && targetNodeId !== boundNodeId) {
          logger.warn(
            `gate-miss gate=4 session=${sessionId} tokenTarget=${targetNodeId} resolvedTarget=${boundNodeId} reason=drift-proposal-route code=${MCP_ERROR_CODES.writeTargetDrift}`,
            'McpSubmit',
          );
          return codedErr(
            `submit_step_output target drift — token target ${targetNodeId} does not match resolved bound node ${boundNodeId}`,
            MCP_ERROR_CODES.writeTargetDrift,
          );
        }
        const proposal = await deps.proposalSubmitter.submit({
          sessionId,
          nodeId: boundNodeId,
          request: { kind: 'submit-step-output', content },
        });
        if (!proposal.ok) return codedErr(proposal.error, MCP_ERROR_CODES.writeUpstreamFailure);
        deps.oneShotTargetStore.setExplicitSubmitSeenThisTurn(sessionId, true);
        logger.info(`submit_step_output session=${sessionId} origin=explicit applied=false proposed=true node=${boundNodeId}`, 'McpSubmit');
        return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
      }

      // Gate 4: target-keyed token check. Required on the autonomous route to
      // catch binding drift between prompt-render and submit (workflow
      // advance, user-confirmed in-flight rebind, decomposition+recurse race).
      if (!targetNodeId) {
        logger.warn(
          `gate-miss gate=4 session=${sessionId} node=${boundNodeId} reason=missing-token code=${MCP_ERROR_CODES.writeMissingToken}`,
          'McpSubmit',
        );
        return codedErr(
          `submit_step_output requires target_node_id on the autonomous route — expected ${boundNodeId}`,
          MCP_ERROR_CODES.writeMissingToken,
        );
      }
      if (targetNodeId !== boundNodeId) {
        logger.warn(
          `gate-miss gate=4 session=${sessionId} tokenTarget=${targetNodeId} resolvedTarget=${boundNodeId} reason=drift code=${MCP_ERROR_CODES.writeTargetDrift}`,
          'McpSubmit',
        );
        return codedErr(
          `submit_step_output target drift — token target ${targetNodeId} does not match resolved bound node ${boundNodeId}`,
          MCP_ERROR_CODES.writeTargetDrift,
        );
      }

      const result = await deps.applier.apply(sessionId, boundNodeId, content);
      if (!result.ok) {
        return codedErr(result.error, result.code ?? MCP_ERROR_CODES.writeUpstreamFailure);
      }

      deps.oneShotTargetStore.setExplicitSubmitSeenThisTurn(sessionId, true);
      logger.info(`submit_step_output session=${sessionId} origin=explicit applied=true node=${boundNodeId}`, 'McpSubmit');
      return ok({ applied: true });
    },
  };
}
