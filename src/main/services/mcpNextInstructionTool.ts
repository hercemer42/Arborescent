import { SessionBindingRegistry } from './sessionBindingRegistry';
import { ToolResult } from './mcpReadTools';
import { PromptQueue } from './mcpPromptQueue';

export interface NextInstructionToolDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  queue: PromptQueue;
}

export interface NextInstructionTool {
  nextInstruction(args: { sessionId: string }): Promise<ToolResult>;
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

export function createNextInstructionTool(deps: NextInstructionToolDeps): NextInstructionTool {
  return {
    nextInstruction: async ({ sessionId }) => {
      const boundNodeId = deps.bindingRegistry.lookup(sessionId);
      if (!boundNodeId) {
        return ok({ hasInstruction: false });
      }
      const next = deps.queue.drain(sessionId);
      if (!next) {
        return ok({ hasInstruction: false });
      }
      return ok({ hasInstruction: true, content: next.content });
    },
  };
}
