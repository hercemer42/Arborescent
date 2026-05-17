import { TreeNode } from '../types';

export type AncestorRegistry = Record<string, string[]>;

export const BASIC_EXECUTE_CONTEXT_ID = '__basic_execute__';
export const BASIC_REVIEW_CONTEXT_ID = '__basic_review__';
export const REVISE_AFTER_DISCUSSION_CONTEXT_ID = '__revise_after_discussion__';

export interface ContextFlags {
  collaborate: boolean;
  execute: boolean;
}

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
