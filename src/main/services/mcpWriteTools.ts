import { SessionBindingRegistry } from './sessionBindingRegistry';
import { resolveBinding } from './bindingResolution';
import { TreeReader, TreeReadState, ToolResult, treeReadFailure } from './mcpReadTools';
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
import { isStructurallyAutonomous, resolveParentStepType } from '../../shared/utils/autonomousStepContext';

export type MutationRequest =
  | { kind: 'add-child'; parentId: string; content: string; position?: number }
  | { kind: 'append'; content: string }
  | { kind: 'mark-complete'; status: 'completed' | 'abandoned' }
  | { kind: 'set-content'; content: string }
  | { kind: 'delete' }
  | { kind: 'move'; newParentId: string; position?: number }
  | { kind: 'set-metadata'; key: string; value: unknown };

export type MutationResult = { ok: true } | { ok: false; error: string };

export interface TreeMutator {
  mutate(sessionId: string, boundNodeId: string, request: MutationRequest): Promise<MutationResult>;
}

export interface WriteToolsDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  treeReader: TreeReader;
  treeMutator: TreeMutator;
  proposalSubmitter: ProposalSubmitter;
  oneShotTargetStore: Pick<OneShotTargetStore, 'setExplicitSubmitSeenThisTurn'>;
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

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

type ResolvedBoundState =
  | { ok: true; boundNodeId: string; state: TreeReadState }
  | { ok: false; error: ToolResult };

async function resolveBoundState(deps: WriteToolsDeps, sessionId: string): Promise<ResolvedBoundState> {
  const resolved = resolveBinding({ bindingRegistry: deps.bindingRegistry }, sessionId, { oneShot: false });
  if (!resolved) {
    return { ok: false, error: err(`No binding found for session ${sessionId}. The session is not bound to any node.`) };
  }
  const boundNodeId = resolved.nodeId;
  const read = await deps.treeReader.readState(sessionId, boundNodeId);
  if (read.kind !== 'ok') {
    return { ok: false, error: treeReadFailure(read.kind, sessionId, boundNodeId) };
  }
  return { ok: true, boundNodeId, state: read.state };
}

function isWithinBoundSubtree(state: TreeReadState, boundNodeId: string, nodeId: string): boolean {
  if (nodeId === boundNodeId) return true;
  if (!state.nodes[nodeId]) return false;
  return (state.ancestorRegistry[nodeId] ?? []).includes(boundNodeId);
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
    return err('No context is applied to the bound step. Tree-modifying tools require an explicitly applied context.');
  }

  // The policy table draws the route distinction: direct-apply (autonomous)
  // and proposal (manual/checkpoint) routes carry separate kind allowances,
  // because the proposal queue is user-reviewed while direct applies are not.
  const automatic = isAutomatic(boundNodeId, state);
  const allowedKinds = automatic
    ? MODE_POLICY[mode].directApplyMutationKinds
    : MODE_POLICY[mode].proposalMutationKinds;
  if (!allowedKinds.includes(request.kind)) {
    return err(MODE_POLICY[mode].mutationRefusal);
  }

  let mutationNodeId = boundNodeId;
  if (targetNodeId !== undefined && targetNodeId !== boundNodeId) {
    if (!isWithinBoundSubtree(state, boundNodeId, targetNodeId)) {
      return err(
        `node_id ${targetNodeId} does not resolve to a node within the bound subtree rooted at ${boundNodeId}.`,
      );
    }
    mutationNodeId = targetNodeId;
  }

  if (!automatic) {
    const proposal = await deps.proposalSubmitter.submit({
      sessionId,
      nodeId: mutationNodeId,
      request,
    });
    if (!proposal.ok) return err(proposal.error);
    return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
  }

  const result = await deps.treeMutator.mutate(sessionId, mutationNodeId, request);
  if (!result.ok) {
    return err(result.error);
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
    return err('No context is applied to the bound step. announce_step_done requires an explicitly applied context whose mode completes via announce.');
  }

  if (MODE_POLICY[mode].completionTool !== 'announce_step_done') {
    return err(MODE_POLICY[mode].announceRefusal ?? 'announce_step_done is not valid for this step mode.');
  }

  // A checkpoint is the natural home for an action-mode done-signal: there is no
  // content to submit for review, so submit_step_output does not apply. Marking
  // the subject complete here does NOT skip the checkpoint's validation — the Stop
  // handler still routes a checkpoint to awaiting-validation rather than advancing.
  // Manual steps stay UI-only: their Stop handler ignores the done-signal entirely.
  const stepType = resolveParentStepType(boundNodeId, state);
  if (stepType !== 'autonomous' && stepType !== 'checkpoint') {
    return err('announce_step_done is only valid on autonomous or checkpoint workflow steps. Manual steps must be resolved through the user interface.');
  }

  const result = await deps.treeMutator.mutate(sessionId, boundNodeId, { kind: 'mark-complete', status: 'completed' });
  if (!result.ok) {
    return err(result.error);
  }

  deps.oneShotTargetStore.setExplicitSubmitSeenThisTurn(sessionId, true);
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
