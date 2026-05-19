import { SessionBindingRegistry, RegisterResult } from './sessionBindingRegistry';
import { logger } from './logger';

export const SEED_BINDINGS_CHANNEL = 'mcp:seed-bindings';
export const CLEAR_BINDINGS_CHANNEL = 'mcp:clear-bindings';

export type SeedPair = {
  sessionId: string;
  nodeId: string;
};

export interface SeedBindingsIpcBridge {
  seed(pairs: SeedPair[]): Array<RegisterResult | null>;
  clear(sessionIds: string[]): number;
  dispose(): void;
}

export interface SeedBindingsIpcBridgeDeps {
  registry: SessionBindingRegistry;
}

export function createSeedBindingsIpcBridge(
  deps: SeedBindingsIpcBridgeDeps,
): SeedBindingsIpcBridge {
  const { registry } = deps;

  function seed(pairs: SeedPair[]): Array<RegisterResult | null> {
    if (pairs.length === 0) return [];

    const results = pairs.map((pair) => registry.register(pair.sessionId, pair.nodeId));

    const setCount = results.filter((r) => r?.kind === 'set').length;
    const rebindCount = results.filter((r) => r?.kind === 'rebind-needed').length;
    logger.info(
      `Seeded ${setCount} new bindings (${rebindCount} conflicts) from file open`,
      'SeedBindingsIpcBridge',
    );

    return results;
  }

  function clear(sessionIds: string[]): number {
    let removed = 0;
    for (const sessionId of sessionIds) {
      if (registry.unregister(sessionId)) {
        removed += 1;
      }
    }
    if (removed > 0) {
      logger.info(`Cleared ${removed} bindings on file close`, 'SeedBindingsIpcBridge');
    }
    return removed;
  }

  function dispose(): void {}

  return { seed, clear, dispose };
}
