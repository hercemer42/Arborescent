import { HookEventPayload } from './hookServer';
import { ArborescentMcpServer } from './mcpServer';
import { logger } from './logger';

export type HookEventDispatcherDeps = {
  getMcpServer: () => ArborescentMcpServer | null;
  forwardToRenderer: (payload: HookEventPayload) => void;
};

export function createHookEventDispatcher(deps: HookEventDispatcherDeps) {
  return function dispatch(payload: HookEventPayload): void {
    if (payload.hook_event_name === 'register-binding') {
      handleRegisterBinding(payload, deps);
      return;
    }
    if (payload.hook_event_name === 'register-target') {
      handleRegisterTarget(payload, deps);
      return;
    }
    if (payload.hook_event_name === 'Stop') {
      deps.forwardToRenderer(attachExplicitSubmitSeen(payload, deps));
      return;
    }
    deps.forwardToRenderer(payload);
  };
}

function attachExplicitSubmitSeen(
  payload: HookEventPayload,
  deps: HookEventDispatcherDeps,
): HookEventPayload {
  const mcpServer = deps.getMcpServer();
  if (!mcpServer) return payload;
  const oneShot = mcpServer.getOneShotTargetStore();
  const seen = oneShot.wasExplicitSubmitSeenThisTurn(payload.session_id);
  // Clear before forwarding so a downstream throw cannot leave the flag armed
  // for a phantom second Stop in the same turn.
  oneShot.setExplicitSubmitSeenThisTurn(payload.session_id, false);
  logger.info(
    `Stop forwarded session=${payload.session_id} explicit_submit_seen=${seen}`,
    'HookDispatch',
  );
  return { ...payload, explicit_submit_seen: seen };
}

function handleRegisterBinding(payload: HookEventPayload, deps: HookEventDispatcherDeps): void {
  const mcpServer = deps.getMcpServer();
  if (!mcpServer) {
    logger.warn('register-binding dropped: MCP server not available', 'HookDispatch');
    return;
  }
  if (!payload.node_uuid) {
    logger.warn('register-binding rejected: missing node_uuid', 'HookDispatch');
    return;
  }
  const registry = mcpServer.getBindingRegistry();
  const result = registry.register(payload.session_id, payload.node_uuid);
  if (!result) {
    logger.warn('register-binding rejected: empty session_id or node_uuid', 'HookDispatch');
    return;
  }
  // Sibling iteration via decomposition+recurse: each hand-off lands a fresh
  // working-node UUID on a session already bound to the prior sibling. The
  // workflow is the user's authority for that hand-off, so we silently flip
  // the binding instead of surfacing the rebind confirmation dialog.
  if (result.kind === 'rebind-needed' && payload.source === 'workflow-advance') {
    registry.confirmRebind(payload.session_id);
  }
  mcpServer.getOneShotTargetStore().setMarkerSeenThisTurn(payload.session_id, true);
  logger.info(
    `register-binding ${result.kind} session=${payload.session_id} node=${payload.node_uuid} source=${payload.source ?? 'none'}`,
    'HookDispatch'
  );
  // session→terminal is independent of node binding state — forward on every
  // register-binding (including rebind-needed without auto-confirmation) so
  // the renderer's workflowSessionMap reflects "this session is alive in this
  // terminal" regardless of whether the user has confirmed the rebind dialog.
  if (payload.terminal_id) {
    deps.forwardToRenderer({
      session_id: payload.session_id,
      hook_event_name: 'session-terminal-mapping',
      terminal_id: payload.terminal_id,
    });
  }
}

function handleRegisterTarget(payload: HookEventPayload, deps: HookEventDispatcherDeps): void {
  const mcpServer = deps.getMcpServer();
  if (!mcpServer) {
    logger.warn('register-target dropped: MCP server not available', 'HookDispatch');
    return;
  }
  if (!payload.session_id) {
    logger.warn('register-target rejected: empty session_id', 'HookDispatch');
    return;
  }
  const oneShot = mcpServer.getOneShotTargetStore();
  if (payload.target_node_uuid) {
    oneShot.setPendingTarget(payload.session_id, payload.target_node_uuid);
  }
  const markerSeen = Boolean(payload.marker_seen_this_turn);
  oneShot.setMarkerSeenThisTurn(payload.session_id, markerSeen);
  // Turn boundary: the explicit-submit flag is per-turn and must reset so
  // the previous turn's completion does not leak into the new turn's Stop.
  oneShot.setExplicitSubmitSeenThisTurn(payload.session_id, false);
  logger.info(
    `register-target session=${payload.session_id} target=${payload.target_node_uuid ?? 'none'} markerSeen=${markerSeen}`,
    'HookDispatch'
  );
}
