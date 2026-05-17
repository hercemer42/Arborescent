import { logger } from './logger';
import { storeManager } from '../store/storeManager';
import { executeInTerminal } from './terminalExecution';

export const IDLE_TTY_TRIGGER_STRING =
  'Arborescent has a queued instruction for this session. Call the next_instruction MCP tool with your session_id to retrieve it.';

type EnqueueListener = (sessionId: string) => void;
type HookListener = (event: { session_id: string; hook_event_name: string }) => void;
type Unsubscribe = () => void;

export interface IdleTtyTriggerDeps {
  onPromptEnqueued: (cb: EnqueueListener) => Unsubscribe;
  onHookEvent: (cb: HookListener) => Unsubscribe;
  writeTerminal: (terminalId: string, data: string) => Promise<void>;
  lookupTerminalForSession: (sessionId: string) => string | null;
}

export interface IdleTtyTriggerService {
  dispose: () => void;
}

export function createIdleTtyTriggerService(deps: IdleTtyTriggerDeps): IdleTtyTriggerService {
  const activeSessions = new Set<string>();

  const unsubscribeHook = deps.onHookEvent((event) => {
    if (!event.session_id) return;
    if (event.hook_event_name === 'SessionStart' || event.hook_event_name === 'UserPromptSubmit') {
      activeSessions.add(event.session_id);
    } else if (event.hook_event_name === 'Stop') {
      activeSessions.delete(event.session_id);
    }
  });

  const unsubscribeEnqueue = deps.onPromptEnqueued((sessionId) => {
    if (!sessionId) {
      logger.warn('idleTtyTrigger ignored enqueue with empty session id', 'IdleTtyTrigger');
      return;
    }
    if (activeSessions.has(sessionId)) {
      return;
    }
    const terminalId = deps.lookupTerminalForSession(sessionId);
    if (!terminalId) {
      logger.warn(`idleTtyTrigger no terminal mapped for session ${sessionId} — skipping paste`, 'IdleTtyTrigger');
      return;
    }
    void deps.writeTerminal(terminalId, IDLE_TTY_TRIGGER_STRING).catch((error) => {
      logger.error(
        `idleTtyTrigger terminal write failed for ${terminalId}`,
        error as Error,
        'IdleTtyTrigger',
      );
    });
  });

  return {
    dispose: () => {
      unsubscribeHook();
      unsubscribeEnqueue();
      activeSessions.clear();
    },
  };
}

function defaultLookupTerminalForSession(sessionId: string): string | null {
  for (const { store } of storeManager.getAllStoreEntries()) {
    const terminalId = store.getState().workflowSessionMap?.[sessionId];
    if (terminalId) return terminalId;
  }
  return null;
}

export function startIdleTtyTriggerService(): () => void {
  const service = createIdleTtyTriggerService({
    onPromptEnqueued: window.electron.onPromptEnqueued,
    onHookEvent: window.electron.onHookEvent,
    writeTerminal: executeInTerminal,
    lookupTerminalForSession: defaultLookupTerminalForSession,
  });
  return service.dispose;
}
