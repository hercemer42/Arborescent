import { SessionBindingRegistry } from './sessionBindingRegistry';
import { TreeReader, TreeReadState, ToolResult } from './mcpReadTools';
import { SubmitMarker } from './submitMarker';

export interface StepOutputApplier {
  apply(
    boundNodeId: string,
    content: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface SubmitOutputToolDeps {
  bindingRegistry: Pick<SessionBindingRegistry, 'lookup'>;
  treeReader: TreeReader;
  applier: StepOutputApplier;
  marker: SubmitMarker;
}

export interface SubmitOutputTool {
  submitStepOutput(args: { sessionId: string; content: string }): Promise<ToolResult>;
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function isAutomatic(nodeId: string, state: TreeReadState): boolean {
  return state.nodes[nodeId]?.metadata.stepType === 'autonomous';
}

export function createSubmitOutputTool(deps: SubmitOutputToolDeps): SubmitOutputTool {
  return {
    submitStepOutput: async ({ sessionId, content }) => {
      const boundNodeId = deps.bindingRegistry.lookup(sessionId);
      if (!boundNodeId) {
        return ok({ applied: false, reason: 'unbound — session has no binding' });
      }

      const state = await deps.treeReader.readState(boundNodeId);
      if (!state) {
        return err('Tree state is unavailable. The renderer may not be ready or no file is open.');
      }
      if (!state.nodes[boundNodeId]) {
        return err(`Bound node ${boundNodeId} not found in the tree (orphan binding).`);
      }

      if (!isAutomatic(boundNodeId, state)) {
        return err(
          'This step is not automatic — your response will be reviewed by the user before any changes are applied. Continue your response normally.',
        );
      }

      if (deps.marker.hasSubmitted(sessionId)) {
        return ok({ applied: false, reason: 'already submitted this turn (deduped)' });
      }

      const result = await deps.applier.apply(boundNodeId, content);
      if (!result.ok) {
        return err(result.error);
      }

      deps.marker.markSubmitted(sessionId);
      return ok({ applied: true });
    },
  };
}
