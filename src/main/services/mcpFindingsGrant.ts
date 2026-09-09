import { TreeNode } from '../../shared/types';
import { resolveParentStepNode } from '../../shared/utils/autonomousStepContext';

// Structural rather than an import of TreeReadState: the read tools consume this
// module, so naming their type here would close an import cycle.
export interface GrantScopeState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: Record<string, string[]>;
}

export function isWithinSubtree(state: GrantScopeState, rootNodeId: string, nodeId: string): boolean {
  if (nodeId === rootNodeId) return true;
  if (!state.nodes[nodeId]) return false;
  return (state.ancestorRegistry[nodeId] ?? []).includes(rootNodeId);
}

// Nothing nests under a link and nothing rewrites one: a hyperlink node's
// subtree is dropped from every send and export, and a back-link is the
// evidence a synthesis rests on rather than part of the synthesis.
function isLinkNode(state: GrantScopeState, nodeId: string): boolean {
  const metadata = state.nodes[nodeId]?.metadata;
  return metadata?.isHyperlink === true || metadata?.isExternalLink === true;
}

// A step declaring a Findings node authorises writes into it. An unresolvable
// destination grants nothing: the session must never receive the parent-not-found
// error, because it has no recovery path and would announce the step done anyway.
// The full workflow shape is required, exactly as the prompt-side resolver
// requires it, so a grant cannot outlive the workflow — removing a workflow
// clears isWorkflow alone and leaves stepType and the destination behind.
function resolveDebriefDestinationId(state: GrantScopeState, boundNodeId: string): string | undefined {
  const step = resolveParentStepNode(boundNodeId, state);
  const destinationId = step?.metadata.debriefDestinationId;
  if (!step || !destinationId) return undefined;

  const stepAncestors = state.ancestorRegistry[step.id] ?? [];
  const workflowId = stepAncestors[stepAncestors.length - 1];
  if (!workflowId || state.nodes[workflowId]?.metadata.isWorkflow !== true) return undefined;

  return state.nodes[destinationId] ? destinationId : undefined;
}

export interface GrantedTarget {
  // Set when the write lands inside a configured Findings subtree, so the
  // applier attaches evidence for exactly the writes the gate authorised as a
  // debrief rather than re-deriving intent from a node flag.
  debriefDestinationId?: string;
  bypassesModePolicy: boolean;
}

export type TargetAuthorisation = GrantedTarget | { refusal: 'out-of-scope' | 'link-node' };

function authoriseAgainstDestination(
  state: GrantScopeState,
  boundNodeId: string,
  targetId: string,
  destinationId: string | undefined,
): TargetAuthorisation {
  const withinDestination = destinationId !== undefined && isWithinSubtree(state, destinationId, targetId);
  const withinBound = isWithinSubtree(state, boundNodeId, targetId);

  if (!withinBound && !withinDestination) return { refusal: 'out-of-scope' };
  if (isLinkNode(state, targetId)) return { refusal: 'link-node' };

  return {
    debriefDestinationId: withinDestination ? destinationId : undefined,
    bypassesModePolicy: withinDestination && !withinBound,
  };
}

// The grant is orthogonal to the context-mode table: it turns on named request
// kinds against a single subtree, so no existing step gains surface and no
// other mutation kind can inherit it.
export function authoriseTarget(
  state: GrantScopeState,
  boundNodeId: string,
  targetId: string,
): TargetAuthorisation {
  return authoriseAgainstDestination(state, boundNodeId, targetId, resolveDebriefDestinationId(state, boundNodeId));
}

// The node-id parameters exist for the debrief loop, so a step with no Findings
// node keeps the bound-node-only reach every read has had until now.
export function authoriseNodeIdParameter(
  state: GrantScopeState,
  boundNodeId: string,
  targetId: string,
): TargetAuthorisation {
  const destinationId = resolveDebriefDestinationId(state, boundNodeId);
  if (destinationId === undefined || !state.nodes[targetId]) return { refusal: 'out-of-scope' };
  return authoriseAgainstDestination(state, boundNodeId, targetId, destinationId);
}
