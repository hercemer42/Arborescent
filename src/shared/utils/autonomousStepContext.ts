import type { TreeNode } from '../types';

export interface AutonomousStepContext<TExecState = unknown> {
  stepId: string;
  execState: TExecState;
}

interface StructuralState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: Record<string, string[]>;
}

interface FullState<TExecState = unknown> extends StructuralState {
  workflowExecutionStates: Record<string, TExecState>;
}

// Scope mirrors the server-side gate-1 contract: a node counts as autonomous
// only when itself or its IMMEDIATE parent carries stepType='autonomous'.
// Grandparent-autonomous shapes are intentionally excluded — production
// submissions never reach the renderer applier through those paths because
// the server's structural check rejects them upstream.
//
// The `ancestors.length > 0` guard is the orphan rule: a self-step with no
// ancestors at all has no tree position to act as a step within, so we treat
// it as null. This preserves compatibility with findOwningWorkflowStepId
// (stepHistory.ts), which is used as the owning-step lookup elsewhere.
function resolveStepId(
  nodeId: string,
  state: StructuralState,
): string | null {
  const node = state.nodes[nodeId];
  if (!node) return null;
  const ancestors = state.ancestorRegistry[nodeId] ?? [];
  const parentId = ancestors[ancestors.length - 1];
  const parent = parentId ? state.nodes[parentId] : null;

  if (parent?.metadata?.stepType === 'autonomous') return parentId!;
  if (node.metadata?.stepType === 'autonomous' && ancestors.length > 0) return nodeId;
  return null;
}

export function isStructurallyAutonomous(
  nodeId: string,
  state: StructuralState,
): boolean {
  return resolveStepId(nodeId, state) !== null;
}

export function getAutonomousStepContext<TExecState = unknown>(
  nodeId: string,
  state: FullState<TExecState>,
): AutonomousStepContext<TExecState> | null {
  const stepId = resolveStepId(nodeId, state);
  if (stepId === null) return null;

  const execState = state.workflowExecutionStates[nodeId];
  if (execState === undefined) return null;

  return { stepId, execState };
}
