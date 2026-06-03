import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeReader, TreeReadState, ToolResult, treeReadFailure } from './mcpReadTools';
import { ProposalSubmitter } from './mcpProposalBridge';
import { OneShotTargetStore } from './oneShotTargetStore';
import {
  resolveContextFlags,
  getContextDeclarations,
  getAppliedContextIdWithInheritance,
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
  markStepComplete(args: { sessionId: string; status: 'completed' | 'abandoned' }): Promise<ToolResult>;
  announceStepDone(args: { sessionId: string }): Promise<ToolResult>;
  setNodeContent(args: { sessionId: string; content: string }): Promise<ToolResult>;
  deleteNode(args: { sessionId: string }): Promise<ToolResult>;
  moveNode(args: { sessionId: string; new_parent_id: string; position?: number }): Promise<ToolResult>;
  setNodeMetadata(args: { sessionId: string; key: string; value: unknown }): Promise<ToolResult>;
}

const ADDITIVE_KINDS: ReadonlySet<MutationRequest['kind']> = new Set([
  'add-child',
  'append',
  'mark-complete',
]);

type Authority = 'allowed' | 'no-context' | 'execute-only' | 'action-mode' | 'destructive-in-both';

function checkAuthority(
  state: TreeReadState,
  boundNodeId: string,
  kind: MutationRequest['kind'],
): Authority {
  // No applied context (own or inherited) means no explicit grant of write authority.
  // Writes default to denied — action mode does not bind, so a bound session reaching
  // a context-less node is an inconsistent state we should refuse rather than fall
  // back to permissive default flags.
  const contextId = getAppliedContextIdWithInheritance(boundNodeId, state.nodes, state.ancestorRegistry);
  if (!contextId) return 'no-context';

  const declarations = getContextDeclarations(state.nodes);
  const flags = resolveContextFlags(contextId, state.nodes, declarations);

  if (!flags.collaborate && flags.execute) return 'execute-only';
  if (!flags.collaborate && !flags.execute) return 'action-mode';
  if (flags.execute && !ADDITIVE_KINDS.has(kind)) return 'destructive-in-both';
  return 'allowed';
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

type ResolvedBinding =
  | { ok: true; boundNodeId: string; state: TreeReadState }
  | { ok: false; error: ToolResult };

async function resolveBoundState(deps: WriteToolsDeps, sessionId: string): Promise<ResolvedBinding> {
  const boundNodeId = deps.bindingRegistry.lookup(sessionId);
  if (!boundNodeId) {
    return { ok: false, error: err(`No binding found for session ${sessionId}. The session is not bound to any node.`) };
  }
  const read = await deps.treeReader.readState(sessionId, boundNodeId);
  if (read.kind !== 'ok') {
    return { ok: false, error: treeReadFailure(read.kind, sessionId, boundNodeId) };
  }
  return { ok: true, boundNodeId, state: read.state };
}

async function executeMutation(
  deps: WriteToolsDeps,
  sessionId: string,
  request: MutationRequest,
): Promise<ToolResult> {
  const resolved = await resolveBoundState(deps, sessionId);
  if (!resolved.ok) return resolved.error;
  const { boundNodeId, state } = resolved;

  const authority = checkAuthority(state, boundNodeId, request.kind);
  if (authority === 'no-context') {
    return err('No context is applied to the bound step. Tree-modifying tools require an explicitly applied context.');
  }
  if (authority === 'execute-only') {
    return err('This is an execute-only step — the current step does not permit node modifications.');
  }
  if (authority === 'action-mode') {
    return err('This is an action-mode step (neither execute nor collaborate set). Tree-modifying tools are not permitted.');
  }
  if (authority === 'destructive-in-both') {
    return err('In execute-and-collaborate mode, only additions and check-offs are allowed; other mutations are blocked.');
  }

  if (!isAutomatic(boundNodeId, state)) {
    const proposal = await deps.proposalSubmitter.submit({
      sessionId,
      nodeId: boundNodeId,
      request,
    });
    if (!proposal.ok) return err(proposal.error);
    return ok({ applied: false, proposed: true, proposalId: proposal.proposalId });
  }

  const result = await deps.treeMutator.mutate(sessionId, boundNodeId, request);
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

  const contextId = getAppliedContextIdWithInheritance(boundNodeId, state.nodes, state.ancestorRegistry);
  if (!contextId) {
    return err('No context is applied to the bound step. announce_step_done requires an explicitly applied execute-only or action-mode context.');
  }

  const declarations = getContextDeclarations(state.nodes);
  const flags = resolveContextFlags(contextId, state.nodes, declarations);

  if (flags.collaborate) {
    return err(
      'announce_step_done is not valid when the applied context has collaborate=true — the step expects content for user review. Call submit_step_output with your updated content instead.',
    );
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
      executeMutation(deps, args.sessionId, { kind: 'mark-complete', status: args.status }),
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
