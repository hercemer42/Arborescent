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
      logger.info(
        `register-binding ${result.kind} session=${payload.session_id} node=${payload.node_uuid}`,
        'HookDispatch'
      );
      return;
    }
    deps.forwardToRenderer(payload);
  };
}
