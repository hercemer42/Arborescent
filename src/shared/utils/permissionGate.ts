import { TreeNode } from '../types';

export type AncestorRegistry = Record<string, string[]>;

export const BASIC_EXECUTE_CONTEXT_ID = '__basic_execute__';
export const BASIC_REVIEW_CONTEXT_ID = '__basic_review__';
export const REVISE_AFTER_DISCUSSION_CONTEXT_ID = '__revise_after_discussion__';

export interface ContextFlags {
  collaborate: boolean;
  execute: boolean;
}

export type StepMode = 'collaborate' | 'both' | 'execute' | 'action';

export type CompletionTool = 'submit_step_output' | 'announce_step_done';

export type StepMutationKind =
  | 'add-child'
  | 'append'
  | 'mark-complete'
  | 'set-content'
  | 'delete'
  | 'move'
  | 'set-metadata';

export interface ModePolicy {
  completionTool: CompletionTool;
  directApplyMutationKinds: readonly StepMutationKind[];
  proposalMutationKinds: readonly StepMutationKind[];
  mutationRefusal: string;
  submitRefusal?: string;
  announceRefusal?: string;
}

export function resolveStepMode(flags: ContextFlags): StepMode {
  if (flags.collaborate && flags.execute) return 'both';
  if (flags.collaborate) return 'collaborate';
  if (flags.execute) return 'execute';
  return 'action';
}

const ADDITIVE_MUTATION_KINDS: readonly StepMutationKind[] = ['add-child', 'append', 'mark-complete'];
const ALL_MUTATION_KINDS: readonly StepMutationKind[] = [
  ...ADDITIVE_MUTATION_KINDS,
  'set-content',
  'delete',
  'move',
  'set-metadata',
];

// The single home for the mode-to-permissions matrix. Every consumer — the
// submit gate, the announce gate, mutation authority, and the prompt
// dispatch — reads this table instead of re-deriving the matrix from flags,
// so the gates and the prompts cannot drift apart. Each mode owns exactly one
// completion channel: collaborate rebuilds via submit_step_output, every
// other mode signals via announce_step_done. Direct-apply (autonomous-route)
// writes are disjoint from the submit rebuild by construction: a mode that
// completes via submit permits no direct-apply mutations, because the rebuild
// would silently overwrite them.
export const MODE_POLICY: Record<StepMode, ModePolicy> = {
  collaborate: {
    completionTool: 'submit_step_output',
    directApplyMutationKinds: [],
    proposalMutationKinds: ALL_MUTATION_KINDS,
    announceRefusal:
      'announce_step_done is not valid on a collaborate step — the step expects content for user review. Call submit_step_output with your updated content instead.',
    mutationRefusal:
      'This is a collaborate step running autonomously — incremental tree writes are not permitted because the step completes with a submit_step_output rebuild that would overwrite them. Express all changes in your single submit_step_output call.',
  },
  both: {
    completionTool: 'announce_step_done',
    directApplyMutationKinds: ADDITIVE_MUTATION_KINDS,
    proposalMutationKinds: ADDITIVE_MUTATION_KINDS,
    mutationRefusal:
      'In execute-and-collaborate mode, only additions and check-offs are allowed; other mutations are blocked.',
    submitRefusal:
      'submit_step_output is not allowed on an execute-and-collaborate step — this step works incrementally. Your additions and check-offs are already recorded; a wholesale resubmission would overwrite nodes added during this run. Signal completion with announce_step_done instead.',
  },
  execute: {
    completionTool: 'announce_step_done',
    directApplyMutationKinds: [],
    proposalMutationKinds: [],
    mutationRefusal:
      'This is an execute-only step — the current step does not permit node modifications.',
    submitRefusal:
      'submit_step_output is not allowed on an execute-only step — there is no content to submit for review. Signal completion with announce_step_done instead.',
  },
  action: {
    completionTool: 'announce_step_done',
    directApplyMutationKinds: [],
    proposalMutationKinds: [],
    mutationRefusal:
      'This is an action-mode step (neither execute nor collaborate set). Tree-modifying tools are not permitted.',
    submitRefusal:
      'submit_step_output is not allowed on an action-mode step — there is no content to submit for review. Signal completion with announce_step_done instead.',
  },
};

export interface ContextDeclaration {
  nodeId: string;
  content: string;
  icon: string;
  color?: string;
  collaborate: boolean;
  execute: boolean;
}

const DEFAULT_FLAGS: ContextFlags = { collaborate: true, execute: false };
const BASIC_EXECUTE_FLAGS: ContextFlags = { collaborate: true, execute: true };
const BASIC_REVIEW_FLAGS: ContextFlags = { collaborate: true, execute: false };
const REVISE_AFTER_DISCUSSION_FLAGS: ContextFlags = { collaborate: true, execute: false };

function isSyntheticContextId(id: string): boolean {
  return (
    id === BASIC_EXECUTE_CONTEXT_ID
    || id === BASIC_REVIEW_CONTEXT_ID
    || id === REVISE_AFTER_DISCUSSION_CONTEXT_ID
  );
}

function readFlagsFromNode(node: TreeNode): ContextFlags {
  const collaborate = node.metadata.collaborate;
  const execute = node.metadata.execute;
  if (typeof collaborate !== 'boolean' && typeof execute !== 'boolean') {
    return DEFAULT_FLAGS;
  }
  return {
    collaborate: typeof collaborate === 'boolean' ? collaborate : false,
    execute: typeof execute === 'boolean' ? execute : false,
  };
}

export function getContextDeclarations(
  nodes: Record<string, TreeNode>
): ContextDeclaration[] {
  return Object.values(nodes)
    .filter(node => node.metadata.isContextDeclaration === true)
    .map(node => {
      const flags = readFlagsFromNode(node);
      return {
        nodeId: node.id,
        content: node.content || 'Untitled context',
        icon: (node.metadata.blueprintIcon as string) || 'lightbulb',
        color: node.metadata.blueprintColor as string | undefined,
        collaborate: flags.collaborate,
        execute: flags.execute,
      };
    })
    .sort((a, b) => a.content.localeCompare(b.content));
}

export function resolveContextFlags(
  contextId: string | undefined,
  nodes: Record<string, TreeNode>,
  contextDeclarations: ContextDeclaration[],
): ContextFlags {
  if (!contextId) return DEFAULT_FLAGS;
  if (contextId === BASIC_EXECUTE_CONTEXT_ID) return BASIC_EXECUTE_FLAGS;
  if (contextId === BASIC_REVIEW_CONTEXT_ID) return BASIC_REVIEW_FLAGS;
  if (contextId === REVISE_AFTER_DISCUSSION_CONTEXT_ID) return REVISE_AFTER_DISCUSSION_FLAGS;
  const declaration = contextDeclarations.find(d => d.nodeId === contextId);
  if (declaration) {
    return { collaborate: declaration.collaborate, execute: declaration.execute };
  }
  const contextNode = nodes[contextId];
  if (contextNode) {
    return readFlagsFromNode(contextNode);
  }
  return DEFAULT_FLAGS;
}

function getAncestorsClosestFirst(
  nodeId: string,
  ancestorRegistry: AncestorRegistry
): string[] {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.slice().reverse();
}

export function getAppliedContextIdWithInheritance(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  const appliedId = node.metadata.appliedContextId as string | undefined;
  if (appliedId && (nodes[appliedId] || isSyntheticContextId(appliedId))) {
    return appliedId;
  }

  for (const ancestorId of getAncestorsClosestFirst(nodeId, ancestorRegistry)) {
    const ancestor = nodes[ancestorId];
    if (!ancestor) continue;
    const ancestorAppliedId = ancestor.metadata.appliedContextId as string | undefined;
    if (ancestorAppliedId && (nodes[ancestorAppliedId] || isSyntheticContextId(ancestorAppliedId))) {
      return ancestorAppliedId;
    }
  }

  return undefined;
}
