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
  resolveParentStepNode,
} from '../../shared/utils/autonomousStepContext';

export type MutationRequest =
  | { kind: 'add-child'; parentId: string; content: string; position?: number; debriefDestinationId?: string }
  | { kind: 'append'; content: string }
  | { kind: 'mark-complete'; status: 'completed' | 'abandoned' }
  | { kind: 'set-content'; content: string }
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
  setNodeContent(args: { sessionId: string; content: string }): Promise<ToolResult>;
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

function isWithinSubtree(state: TreeReadState, rootNodeId: string, nodeId: string): boolean {
  if (nodeId === rootNodeId) return true;
  if (!state.nodes[nodeId]) return false;
  return (state.ancestorRegistry[nodeId] ?? []).includes(rootNodeId);
}

// A step declaring a Findings node authorises writes into it. An unresolvable
// destination grants nothing: the session must never receive the parent-not-found
// error, because it has no recovery path and would announce the step done anyway.
// The full workflow shape is required, exactly as the prompt-side resolver
// requires it, so a grant cannot outlive the workflow — removing a workflow
// clears isWorkflow alone and leaves stepType and the destination behind.
function resolveDebriefDestinationId(state: TreeReadState, boundNodeId: string): string | undefined {
  const step = resolveParentStepNode(boundNodeId, state);
  const destinationId = step?.metadata.debriefDestinationId;
  if (!step || !destinationId) return undefined;

  const stepAncestors = state.ancestorRegistry[step.id] ?? [];
  const workflowId = stepAncestors[stepAncestors.length - 1];
  if (!workflowId || state.nodes[workflowId]?.metadata.isWorkflow !== true) return undefined;

  return state.nodes[destinationId] ? destinationId : undefined;
}

interface AddChildAuthorisation {
  // Set when the write lands inside a configured Findings subtree, so the
  // applier attaches evidence for exactly the writes the gate authorised as a
  // debrief rather than re-deriving intent from a node flag.
  debriefDestinationId?: string;
  bypassesModePolicy: boolean;
}

// Nothing nests under a link: a hyperlink node's subtree is dropped from every
// send and export, so a child written there is invisible to everything that
// reads the tree back.
function isLinkNode(state: TreeReadState, nodeId: string): boolean {
  const metadata = state.nodes[nodeId]?.metadata;
  return metadata?.isHyperlink === true || metadata?.isExternalLink === true;
}

// The grant is orthogonal to the context-mode table: it turns on a single
// request kind against a single subtree, so no existing step gains surface and
// no other mutation kind can inherit it. Refusals are worded here, where the
// reason for them is known.
function authoriseAddChildParent(
  state: TreeReadState,
  boundNodeId: string,
  parentId: string,
): AddChildAuthorisation | { refusal: ToolResult } {
  const destinationId = resolveDebriefDestinationId(state, boundNodeId);
  const withinDestination = destinationId !== undefined && isWithinSubtree(state, destinationId, parentId);
  const withinBound = isWithinSubtree(state, boundNodeId, parentId);

  if (!withinBound && !withinDestination) {
    return {
      refusal: codedErr(
        `parent_id ${parentId} is neither inside the bound subtree rooted at ${boundNodeId} nor inside a Findings node this step is configured to write to.`,
        MCP_ERROR_CODES.writeOutsideBoundSubtree,
      ),
    };
  }

  if (isLinkNode(state, parentId)) {
    return {
      refusal: codedErr(
        `parent_id ${parentId} is a hyperlink — nothing can be nested beneath a link.`,
        MCP_ERROR_CODES.writeOutsideBoundSubtree,
      ),
    };
  }

  return {
    debriefDestinationId: withinDestination ? destinationId : undefined,
    bypassesModePolicy: withinDestination && !withinBound,
  };
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
  if (request.kind === 'add-child') {
    const authorisation = authoriseAddChildParent(state, boundNodeId, request.parentId);
    if ('refusal' in authorisation) return authorisation.refusal;
    authorisedByDebriefDestination = automatic && authorisation.bypassesModePolicy;
    if (authorisation.debriefDestinationId) {
      effectiveRequest = { ...request, debriefDestinationId: authorisation.debriefDestinationId };
    }
  }

  const allowedKinds = automatic
    ? MODE_POLICY[mode].directApplyMutationKinds
    : MODE_POLICY[mode].proposalMutationKinds;
  if (!authorisedByDebriefDestination && !allowedKinds.includes(request.kind)) {
    return codedErr(MODE_POLICY[mode].mutationRefusal, MCP_ERROR_CODES.writeModeRefusal);
  }

  let mutationNodeId = boundNodeId;
  if (targetNodeId !== undefined && targetNodeId !== boundNodeId) {
    if (!isWithinSubtree(state, boundNodeId, targetNodeId)) {
      return codedErr(
        `node_id ${targetNodeId} does not resolve to a node within the bound subtree rooted at ${boundNodeId}.`,
        MCP_ERROR_CODES.writeOutsideBoundSubtree,
      );
    }
    mutationNodeId = targetNodeId;
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
      executeMutation(deps, args.sessionId, { kind: 'set-content', content: args.content }),
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
