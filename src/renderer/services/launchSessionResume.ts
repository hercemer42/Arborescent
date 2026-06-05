import { useTerminalStore, type LaunchResumeTarget } from '../store/terminal/terminalStore';
import { storeManager } from '../store/storeManager';
import { mapWithConcurrency } from '../utils/concurrency';
import { logger } from './logger';

const LAUNCH_RESUME_CONCURRENCY = 4;

export interface LaunchSessionResumeDeps {
  materializeAll: () => Promise<LaunchResumeTarget[]>;
  resumeForFile: (filePath: string, terminalId: string, sessionId: string) => Promise<void>;
  concurrency?: number;
}

function defaultDeps(): LaunchSessionResumeDeps {
  return {
    materializeAll: () => useTerminalStore.getState().materializeAllRestoredTerminals(),
    resumeForFile: (filePath, terminalId, sessionId) =>
      storeManager.getStoreForFile(filePath).getState().actions.resumeRestoredTerminal(terminalId, sessionId),
  };
}

// Materializes every open file's restored terminals and resumes each that carries
// a session, throttled so the launch-time process spike stays bounded. Each
// resume is isolated so one failure cannot abort the rest or surface a storm.
export async function resumeAllRestoredSessions(deps: LaunchSessionResumeDeps = defaultDeps()): Promise<void> {
  try {
    const targets = await deps.materializeAll();
    if (targets.length === 0) return;

    await mapWithConcurrency(targets, deps.concurrency ?? LAUNCH_RESUME_CONCURRENCY, async (target) => {
      try {
        await deps.resumeForFile(target.filePath, target.terminalId, target.sessionId);
      } catch (error) {
        logger.warn(`Launch resume failed for terminal ${target.terminalId}: ${(error as Error).message}`, 'App');
      }
    });
  } catch (error) {
    logger.error('Failed to resume restored sessions at launch', error as Error, 'App');
  }
}
