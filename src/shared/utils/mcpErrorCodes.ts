// Stable machine-readable error codes for the MCP server. Codes are a
// published contract: additive only, never renamed once shipped. The prose
// delivered alongside a code may be reworded freely — clients branch on the
// code, humans read the prose. The module lives in src/shared because the
// applier sub-namespace originates in the renderer and travels to the main
// process over IPC.
export const MCP_ERROR_CODES = {
  readNotReady: 'read/not-ready',
  readNoSessionStore: 'read/no-session-store',
  readNodeNotInOpenStore: 'read/node-not-in-open-store',
  // Also returned by read tools for the unbound-session precondition; the
  // prefix is origin-grouping, not a strict tool class.
  writeUnbound: 'write/unbound',
  writeNoContext: 'write/no-context',
  writeModeRefusal: 'write/mode-refusal',
  writeTargetDrift: 'write/target-drift',
  writeMissingToken: 'write/missing-token',
  writeOutsideBoundSubtree: 'write/outside-bound-subtree',
  writeManualStep: 'write/manual-step',
  writeUpstreamFailure: 'write/upstream-failure',
  applierNodeNotFound: 'applier/node-not-found',
  applierHandlerUnavailable: 'applier/workflow-handler-unavailable',
  applierRoutingDisagreement: 'applier/routing-disagreement',
  applierThrew: 'applier/applier-threw',
  applierNoStore: 'applier/no-store',
} as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[keyof typeof MCP_ERROR_CODES];

// Default prose per code. Call sites that know more (ids, policy refusals)
// deliver their own richer prose; the code is the stable part either way.
export const MCP_ERROR_MESSAGES: Record<McpErrorCode, string> = {
  'read/not-ready':
    'Tree read got no response — the renderer is not ready. This is transient: retry once after a short wait.',
  'read/no-session-store':
    'No open file owns this session — the file may not be open, or the session may not be registered yet.',
  'read/node-not-in-open-store':
    'The bound node is not in the file owned by this session — it may have been deleted, or it lives in a different file.',
  'write/unbound':
    'No target node registered and no workflow binding for this session.',
  'write/no-context':
    'No context is applied to the bound step — the tool requires an explicitly applied context.',
  'write/mode-refusal':
    'The tool is not permitted for the bound step mode.',
  'write/target-drift':
    'The token target does not match the resolved bound node — the binding drifted between prompt-render and the call.',
  'write/missing-token':
    'target_node_id is required on the autonomous route to guard against binding drift.',
  'write/outside-bound-subtree':
    'The node_id does not resolve to a node within the bound subtree.',
  'write/manual-step':
    'The tool is only valid on autonomous or checkpoint workflow steps; manual steps are resolved through the user interface.',
  'write/upstream-failure':
    'A downstream apply, mutation, or proposal failed without a more specific code.',
  'applier/node-not-found':
    'The target node was not found in the owning store at apply time.',
  'applier/workflow-handler-unavailable':
    'The workflow feedback handler is unavailable for a workflow-active node.',
  'applier/routing-disagreement':
    'The server routed the apply as autonomous but the renderer has no execution context for the node.',
  'applier/applier-threw':
    'The renderer applier threw while applying the content.',
  'applier/no-store':
    'No open file owns the session that requested the apply.',
};
