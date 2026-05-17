import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeReader, TreeReadState, ToolResult } from './mcpReadTools';
import {
  resolveContextFlags,
  getContextDeclarations,
  getAppliedContextIdWithInheritance,
} from '../../shared/utils/permissionGate';

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
  mutate(boundNodeId: string, request: MutationRequest): Promise<MutationResult>;
}

export interface WriteToolsDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  treeReader: TreeReader;
  treeMutator: TreeMutator;
}

export interface WriteTools {
  addChildNode(args: { sessionId: string; parent_id: string; content: string; position?: number }): Promise<ToolResult>;
  appendToNode(args: { sessionId: string; content: string }): Promise<ToolResult>;
  markStepComplete(args: { sessionId: string; status: 'completed' | 'abandoned' }): Promise<ToolResult>;
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
  return state.nodes[nodeId]?.metadata.stepType === 'autonomous';
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function executeMutation(
  deps: WriteToolsDeps,
  sessionId: string,
  request: MutationRequest,
): Promise<ToolResult> {
  const boundNodeId = deps.bindingRegistry.lookup(sessionId);
  if (!boundNodeId) {
    return err(`No binding found for session ${sessionId}. The session is not bound to any node.`);
  }
  const state = await deps.treeReader.readState(boundNodeId);
  if (!state) {
    return err('Tree state is unavailable. The renderer may not be ready or no file is open.');
  }
  if (!state.nodes[boundNodeId]) {
    return err(`Bound node ${boundNodeId} not found in the tree (orphan binding).`);
  }

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
    return err(
      'Mutations against non-automatic steps require user review as a proposal. This is not yet supported in this PR.',
    );
  }

  const result = await deps.treeMutator.mutate(boundNodeId, request);
  if (!result.ok) {
    return err(result.error);
  }
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
