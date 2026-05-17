import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeNode } from '../../shared/types';
import {
  resolveContextFlags,
  getContextDeclarations,
  getAppliedContextIdWithInheritance,
} from '../../shared/utils/permissionGate';

export interface TreeReadState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
}

export interface TreeReader {
  readState(boundNodeId: string): Promise<TreeReadState | null>;
}

export interface ReadToolsDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  treeReader: TreeReader;
}

export type ModeLabel = 'action' | 'execute' | 'collaborate' | 'both';

export interface EffectiveMode {
  collaborate: boolean;
  execute: boolean;
  label: ModeLabel;
}

interface ToolResultContent {
  type: 'text';
  text: string;
}

// The index signature is required by the MCP SDK's CallToolResult type, which is open
// for extension with extra fields. Without it, our narrow ToolResult is not assignable
// to the SDK's expected return type at registerTool call sites.
export interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface GetNodeArgs {
  sessionId: string;
}

export interface GetTreeArgs {
  sessionId: string;
  depth?: number;
}

export interface ListContextsArgs {
  sessionId: string;
}

export interface ReadTools {
  getNode(args: GetNodeArgs): Promise<ToolResult>;
  getTree(args: GetTreeArgs): Promise<ToolResult>;
  listContexts(args: ListContextsArgs): Promise<ToolResult>;
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function modeLabel(collaborate: boolean, execute: boolean): ModeLabel {
  if (collaborate && execute) return 'both';
  if (collaborate) return 'collaborate';
  if (execute) return 'execute';
  return 'action';
}

function computeEffectiveMode(
  nodeId: string,
  state: TreeReadState,
): EffectiveMode {
  const contextId = getAppliedContextIdWithInheritance(
    nodeId,
    state.nodes,
    state.ancestorRegistry,
  );
  const declarations = getContextDeclarations(state.nodes);
  const flags = resolveContextFlags(contextId, state.nodes, declarations);
  return {
    collaborate: flags.collaborate,
    execute: flags.execute,
    label: modeLabel(flags.collaborate, flags.execute),
  };
}

interface SerializedTreeNode {
  id: string;
  content: string;
  metadata: TreeNode['metadata'];
  children: SerializedTreeNode[];
}

// Depth cap is a defensive ceiling: prevents a malformed tree with cyclic children
// from blowing the JS stack here. Real Arborescent trees are well-formed, but tool
// callers should not be able to crash the MCP server via a state corruption bug.
const MAX_TREE_DEPTH = 100;

function serializeSubtree(
  nodeId: string,
  state: TreeReadState,
  remainingDepth: number,
  visited: Set<string> = new Set(),
): SerializedTreeNode | null {
  const node = state.nodes[nodeId];
  if (!node) return null;
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);
  const children =
    remainingDepth <= 0
      ? []
      : node.children
          .map((childId) => serializeSubtree(childId, state, remainingDepth - 1, visited))
          .filter((c): c is SerializedTreeNode => c !== null);
  return {
    id: node.id,
    content: node.content,
    metadata: node.metadata,
    children,
  };
}

interface SerializedContext {
  id: string;
  content: string;
  collaborate: boolean;
  execute: boolean;
  applied: boolean;
}

function contextsInScope(
  boundNodeId: string,
  state: TreeReadState,
): SerializedContext[] {
  const appliedId = getAppliedContextIdWithInheritance(
    boundNodeId,
    state.nodes,
    state.ancestorRegistry,
  );
  const declarations = getContextDeclarations(state.nodes);
  const annotated: SerializedContext[] = declarations.map((d) => ({
    id: d.nodeId,
    content: d.content,
    collaborate: d.collaborate,
    execute: d.execute,
    applied: d.nodeId === appliedId,
  }));
  annotated.sort((a, b) => {
    if (a.applied && !b.applied) return -1;
    if (!a.applied && b.applied) return 1;
    return a.content.localeCompare(b.content);
  });
  return annotated;
}

async function withBoundNode<T>(
  deps: ReadToolsDeps,
  sessionId: string,
  fn: (boundNodeId: string, state: TreeReadState) => T | Promise<T>,
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
  const payload = await fn(boundNodeId, state);
  return ok(payload);
}

export function createReadTools(deps: ReadToolsDeps): ReadTools {
  return {
    async getNode(args) {
      return withBoundNode(deps, args.sessionId, (boundNodeId, state) => {
        const node = state.nodes[boundNodeId];
        return {
          id: node.id,
          content: node.content,
          metadata: node.metadata,
          mode: computeEffectiveMode(boundNodeId, state),
        };
      });
    },

    async getTree(args) {
      if (typeof args.depth === 'number' && args.depth < 0) {
        return err(`Invalid depth ${args.depth}: must be a non-negative integer.`);
      }
      return withBoundNode(deps, args.sessionId, (boundNodeId, state) => {
        const depth = Math.min(args.depth ?? MAX_TREE_DEPTH, MAX_TREE_DEPTH);
        return serializeSubtree(boundNodeId, state, depth);
      });
    },

    async listContexts(args) {
      return withBoundNode(deps, args.sessionId, (boundNodeId, state) => {
        return contextsInScope(boundNodeId, state);
      });
    },
  };
}
