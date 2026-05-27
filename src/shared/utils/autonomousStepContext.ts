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

// Binding contract: a session is always bound to the SUBJECT node — the node
// that travels through the workflow's steps. Its UUID is stable across step
// advances; what changes is its parent, which is always the current step.
// The subject therefore sits at exactly depth-1 below the step it is in, so a
// node counts as autonomous iff its IMMEDIATE parent carries
// stepType='autonomous'. The subject itself never carries stepType (steps do),
// and the depth never varies — so there is no self-step case and no reason to
// walk past the immediate parent.
function resolveParentStep(
  nodeId: string,
  state: StructuralState,
): TreeNode | null {
  const node = state.nodes[nodeId];
  if (!node) return null;
  const ancestors = state.ancestorRegistry[nodeId] ?? [];
  const parentId = ancestors[ancestors.length - 1];
  return parentId ? state.nodes[parentId] ?? null : null;
}

function resolveStepId(
  nodeId: string,
  state: StructuralState,
): string | null {
  const parent = resolveParentStep(nodeId, state);
  return parent?.metadata?.stepType === 'autonomous' ? parent.id : null;
}

export function isStructurallyAutonomous(
  nodeId: string,
  state: StructuralState,
): boolean {
  return resolveStepId(nodeId, state) !== null;
}

export function resolveParentStepType(
  nodeId: string,
  state: StructuralState,
): TreeNode['metadata']['stepType'] {
  return resolveParentStep(nodeId, state)?.metadata?.stepType;
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
