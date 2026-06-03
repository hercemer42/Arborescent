import { SessionBindingRegistry } from './sessionBindingRegistry';
import { OneShotTargetStore } from './oneShotTargetStore';
import type { MainBindingFact } from '../../shared/utils/bindingAuthority';

// Typed against BINDING_AUTHORITY: this resolver may consult only facts the
// table assigns to the main process. Moving a fact's owner breaks this
// declaration at compile time before the resolver can silently drift.
export const CONSULTED_BINDING_FACTS: readonly MainBindingFact[] = ['session-to-node'];

export type BindingSource = 'one-shot' | 'workflow';

export interface ResolvedBinding {
  nodeId: string;
  source: BindingSource;
}

export interface BindingResolutionDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  oneShotTargetStore?: Pick<OneShotTargetStore, 'pendingTarget'>;
}

// Single binding-resolution entry point for all main-process MCP tools.
// Consulting the one-shot store is an explicit opt-in: read and write tools
// pass oneShot false so they never silently gain pendingTarget semantics.
// Policy (mode gates, failure rendering) stays with the callers — the
// resolver only reports which source won.
export function resolveBinding(
  deps: BindingResolutionDeps,
  sessionId: string,
  opts: { oneShot: boolean },
): ResolvedBinding | null {
  if (opts.oneShot) {
    const pendingTarget = deps.oneShotTargetStore?.pendingTarget(sessionId) ?? null;
    if (pendingTarget) {
      return { nodeId: pendingTarget, source: 'one-shot' };
    }
  }
  const boundNodeId = deps.bindingRegistry.lookup(sessionId);
  if (!boundNodeId) {
    return null;
  }
  return { nodeId: boundNodeId, source: 'workflow' };
}
