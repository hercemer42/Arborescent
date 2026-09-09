import { SessionBindingRegistry } from './sessionBindingRegistry';
import { resolveBinding } from './bindingResolution';
import { TreeReader, TreeReadState, ToolResult, treeReadFailure, codedErr } from './mcpReadTools';
import { MCP_ERROR_CODES, McpErrorCode } from '../../shared/utils/mcpErrorCodes';
import { ProposalSubmitter } from './mcpProposalBridge';
import { OneShotTargetStore } from './oneShotTargetStore';
import {
  resolveContextFlags,
  getContextDeclarations,
  getAppliedContextIdWithInheritance,
  resolveStepMode,
  MODE_POLICY,
  StepMode,
} from '../../shared/utils/permissionGate';
import {
  isStructurallyAutonomous,
  resolveParentStepType,
} from '../../shared/utils/autonomousStepContext';
import { authoriseTarget, authoriseNodeIdParameter, isWithinSubtree } from './mcpFindingsGrant';

export type MutationRequest =
  | { kind: 'add-child'; parentId: string; content: string; position?: number; debriefDestinationId?: string }
  | { kind: 'append'; content: string }
  | { kind: 'mark-complete'; status: 'completed' | 'abandoned' }
  | { kind: 'set-content'; content: string; debriefDestinationId?: string; subjectNodeId?: string }
  | { kind: 'delete' }
  | { kind: 'move'; newParentId: string; position?: number }
  | { kind: 'set-metadata'; key: string; value: unknown };

export type MutationResult = { ok: true } | { ok: false; error: string; code?: McpErrorCode };

export interface TreeMutator {
  mutate(sessionId: string, boundNodeId: string, request: MutationRequest): Promise<MutationResult>;
}

export interface WriteToolsDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  treeReader: TreeReader;
  treeMutator: TreeMutator;
  proposalSubmitter: ProposalSubmitter;
  oneShotTargetStore: Pick<OneShotTargetStore, 'recordDoneDeclaration'>;
}

export interface WriteTools {
  addChildNode(args: { sessionId: string; parent_id: string; content: string; position?: number }): Promise<ToolResult>;
  appendToNode(args: { sessionId: string; content: string }): Promise<ToolResult>;
  markStepComplete(args: { sessionId: string; status: 'completed' | 'abandoned'; node_id?: string }): Promise<ToolResult>;
  announceStepDone(args: { sessionId: string }): Promise<ToolResult>;
  setNodeContent(args: { sessionId: string; content: string; node_id?: string }): Promise<ToolResult>;
  deleteNode(args: { sessionId: string }): Promise<ToolResult>;
  moveNode(args: { sessionId: string; new_parent_id: string; position?: number }): Promise<ToolResult>;
  setNodeMetadata(args: { sessionId: string; key: string; value: unknown }): Promise<ToolResult>;
}

function resolveBoundStepMode(state: TreeReadState, boundNodeId: string): StepMode | 'no-context' {
  // No applied context (own or inherited) means no explicit grant of write authority.
  // Writes default to denied — action mode does not bind, so a bound session reaching
  // a context-less node is an inconsistent state we should refuse rather than fall
  // back to permissive default flags.
  const contextId = getAppliedContextIdWithInheritance(boundNodeId, state.nodes, state.ancestorRegistry);
  if (!contextId) return 'no-context';

  const declarations = getContextDeclarations(state.nodes);
  return resolveStepMode(resolveContextFlags(contextId, state.nodes, declarations));
}

function isAutomatic(nodeId: string, state: TreeReadState): boolean {
  // The bound node (the subject that travels through the workflow) is autonomous
  // when its immediate parent — the current step — carries stepType='autonomous'.
  // This gates the executeMutation proposal route: only an autonomous step applies
  // a mutation directly; manual and checkpoint steps queue it for user review.
  return isStructurallyAutonomous(nodeId, state);
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

type ResolvedBoundState =
  | { ok: true; boundNodeId: string; state: TreeReadState }
  | { ok: false; error: ToolResult };

async function resolveBoundState(deps: WriteToolsDeps, sessionId: string): Promise<ResolvedBoundState> {
  const resolved = resolveBinding({ bindingRegistry: deps.bindingRegistry }, sessionId, { oneShot: false });
  if (!resolved) {
    return {
      ok: false,
      error: codedErr(
        `No binding found for session ${sessionId}. The session is not bound to any node.`,
        MCP_ERROR_CODES.writeUnbound,
      ),
    };
  }
  const boundNodeId = resolved.nodeId;
  const read = await deps.treeReader.readState(sessionId, boundNodeId);
  if (read.kind !== 'ok') {
    return { ok: false, error: treeReadFailure(read.kind, sessionId, boundNodeId) };
  }
  return { ok: true, boundNodeId, state: read.state };
}

// Out-of-scope reads the same for either parameter; a link refusal does not,
// because nesting under a link and rewriting one fail for different reasons.
const LINK_REFUSALS = {
  parent_id: (targetId: string) => `parent_id ${targetId} is a hyperlink — nothing can be nested beneath a link.`,
  node_id: (targetId: string) => `node_id ${targetId} is a hyperlink — a back-link is evidence and cannot be rewritten.`,
};

function targetRefusal(
  authorisation: { refusal: 'out-of-scope' | 'link-node' },
  parameter: keyof typeof LINK_REFUSALS,
  boundNodeId: string,
  targetId: string,
): ToolResult {
  const message =
    authorisation.refusal === 'link-node'
      ? LINK_REFUSALS[parameter](targetId)
      : `${parameter} ${targetId} is neither inside the bound subtree rooted at ${boundNodeId} nor inside a Findings node this step is configured to write to.`;
  return codedErr(message, MCP_ERROR_CODES.writeOutsideBoundSubtree);
}

async function executeMutation(
  deps: WriteToolsDeps,
  sessionId: string,
  request: MutationRequest,
  targetNodeId?: string,
): Promise<ToolResult> {
  const resolved = await resolveBoundState(deps, sessionId);
  if (!resolved.ok) return resolved.error;
  const { boundNodeId, state } = resolved;

  const mode = resolveBoundStepMode(state, boundNodeId);
  if (mode === 'no-context') {
    return codedErr(
      'No context is applied to the bound step. Tree-modifying tools require an explicitly applied context.',
      MCP_ERROR_CODES.writeNoContext,
    );
  }

  // The policy table draws the route distinction: direct-apply (autonomous)
  // and proposal (manual/checkpoint) routes carry separate kind allowances,
  // because the proposal queue is user-reviewed while direct applies are not.
  const automatic = isAutomatic(boundNodeId, state);

  // Autonomous-only is mechanical: on the proposal route every write becomes a
  // review proposition, and the receiver rejects every proposition that is not a
  // submit_step_output, so the grant would authorise a write that cannot land.
  let effectiveRequest = request;
  let authorisedByDebriefDestination = false;
  let mutationNodeId = boundNodeId;

  if (request.kind === 'add-child') {
    const authorisation = authoriseTarget(state, boundNodeId, request.parentId);
    if ('refusal' in authorisation) return targetRefusal(authorisation, 'parent_id', boundNodeId, request.parentId);
    authorisedByDebriefDestination = automatic && authorisation.bypassesModePolicy;
    if (authorisation.debriefDestinationId) {
      effectiveRequest = { ...request, debriefDestinationId: authorisation.debriefDestinationId };
    }
  }

  if (targetNodeId !== undefined && targetNodeId !== boundNodeId) {
    if (request.kind === 'set-content') {
      const authorisation = authoriseNodeIdParameter(state, boundNodeId, targetNodeId);
      if ('refusal' in authorisation) return targetRefusal(authorisation, 'node_id', boundNodeId, targetNodeId);
      authorisedByDebriefDestination = automatic && authorisation.bypassesModePolicy;
      if (authorisation.debriefDestinationId) {
        effectiveRequest = {
          ...request,
          debriefDestinationId: authorisation.debriefDestinationId,
          subjectNodeId: boundNodeId,
        };
      }
    } else if (!isWithinSubtree(state, boundNodeId, targetNodeId)) {
      return codedErr(
        `node_id ${targetNodeId} does not resolve to a node within the bound subtree rooted at ${boundNodeId}.`,
        MCP_ERROR_CODES.writeOutsideBoundSubtree,
      );
    }
    mutationNodeId = targetNodeId;
  }

  const allowedKinds = automatic
    ? MODE_POLICY[mode].directApplyMutationKinds
    : MODE_POLICY[mode].proposalMutationKinds;
  if (!authorisedByDebriefDestination && !allowedKinds.includes(request.kind)) {
    return codedErr(MODE_POLICY[mode].mutationRefusal, MCP_ERROR_CODES.writeModeRefusal);
  }

  return dispatchMutation(deps, sessionId, mutationNodeId, effectiveRequest, automatic);
}

// The proposal queue is user-reviewed while a direct apply is not, so the route
// a mutation takes is the route its authority was granted for.
async function dispatchMutation(
  deps: WriteToolsDeps,
  sessionId: string,
  mutationNodeId: string,
  request: MutationRequest,
  automatic: boolean,
): Promise<ToolResult> {
  if (!automatic) {
    const proposal = await deps.proposalSubmitter.submit({
      sessionId,
      nodeId: mutationNodeId,
      request,
    });
    if (!proposal.ok) return codedErr(proposal.error, MCP_ERROR_CODES.writeUpstreamFailure);
    return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
  }

  const result = await deps.treeMutator.mutate(sessionId, mutationNodeId, request);
  if (!result.ok) {
    return codedErr(result.error, result.code ?? MCP_ERROR_CODES.writeUpstreamFailure);
  }
  return ok({ applied: true });
}

async function executeAnnounceStepDone(
  deps: WriteToolsDeps,
  sessionId: string,
): Promise<ToolResult> {
  const resolved = await resolveBoundState(deps, sessionId);
  if (!resolved.ok) return resolved.error;
  const { boundNodeId, state } = resolved;

  const mode = resolveBoundStepMode(state, boundNodeId);
  if (mode === 'no-context') {
    return codedErr(
      'No context is applied to the bound step. announce_step_done requires an explicitly applied context whose mode completes via announce.',
      MCP_ERROR_CODES.writeNoContext,
    );
  }

  if (MODE_POLICY[mode].completionTool !== 'announce_step_done') {
    return codedErr(
      MODE_POLICY[mode].announceRefusal ?? 'announce_step_done is not valid for this step mode.',
      MCP_ERROR_CODES.writeModeRefusal,
    );
  }

  // A checkpoint is the natural home for an action-mode done-signal: there is no
  // content to submit for review, so submit_step_output does not apply. Marking
  // the subject complete here does NOT skip the checkpoint's validation — the Stop
  // handler still routes a checkpoint to awaiting-validation rather than advancing.
  // Manual steps stay UI-only: their Stop handler ignores the done-signal entirely.
  const stepType = resolveParentStepType(boundNodeId, state);
  if (stepType !== 'autonomous' && stepType !== 'checkpoint') {
    return codedErr(
      'announce_step_done is only valid on autonomous or checkpoint workflow steps. Manual steps must be resolved through the user interface.',
      MCP_ERROR_CODES.writeManualStep,
    );
  }

  const result = await deps.treeMutator.mutate(sessionId, boundNodeId, { kind: 'mark-complete', status: 'completed' });
  if (!result.ok) {
    return codedErr(result.error, result.code ?? MCP_ERROR_CODES.writeUpstreamFailure);
  }

  deps.oneShotTargetStore.recordDoneDeclaration(sessionId, boundNodeId);
  return ok({ applied: true });
}

export function createWriteTools(deps: WriteToolsDeps): WriteTools {
  return {
    addChildNode: (args) => {
      const request: MutationRequest =
        args.position !== undefined
          ? { kind: 'add-child', parentId: args.parent_id, content: args.content, position: args.position }
          : { kind: 'add-child', parentId: args.parent_id, content: args.content };
      return executeMutation(deps, args.sessionId, request);
    },
    appendToNode: (args) =>
      executeMutation(deps, args.sessionId, { kind: 'append', content: args.content }),
    markStepComplete: (args) =>
      executeMutation(deps, args.sessionId, { kind: 'mark-complete', status: args.status }, args.node_id),
    announceStepDone: (args) => executeAnnounceStepDone(deps, args.sessionId),
    setNodeContent: (args) =>
      executeMutation(deps, args.sessionId, { kind: 'set-content', content: args.content }, args.node_id),
    deleteNode: (args) => executeMutation(deps, args.sessionId, { kind: 'delete' }),
    moveNode: (args) => {
      const request: MutationRequest =
        args.position !== undefined
          ? { kind: 'move', newParentId: args.new_parent_id, position: args.position }
          : { kind: 'move', newParentId: args.new_parent_id };
      return executeMutation(deps, args.sessionId, request);
    },
    setNodeMetadata: (args) =>
      executeMutation(deps, args.sessionId, { kind: 'set-metadata', key: args.key, value: args.value }),
  };
}
