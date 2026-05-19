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
    deps.forwardToRenderer(payload);
  };
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
  const result = mcpServer.getBindingRegistry().register(payload.session_id, payload.node_uuid);
  if (!result) {
    logger.warn('register-binding rejected: empty session_id or node_uuid', 'HookDispatch');
    return;
  }
  mcpServer.getOneShotTargetStore().setMarkerSeenThisTurn(payload.session_id, true);
  logger.info(
    `register-binding ${result.kind} session=${payload.session_id} node=${payload.node_uuid}`,
    'HookDispatch'
  );
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
  } else {
    oneShot.clearPendingTarget(payload.session_id);
  }
  const markerSeen = Boolean(payload.marker_seen_this_turn);
  oneShot.setMarkerSeenThisTurn(payload.session_id, markerSeen);
  logger.info(
    `register-target session=${payload.session_id} target=${payload.target_node_uuid ?? 'none'} markerSeen=${markerSeen}`,
    'HookDispatch'
  );
}
