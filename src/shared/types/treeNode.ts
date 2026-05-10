export type NodeStatus = 'pending' | 'completed' | 'abandoned';

export const STATUS_SYMBOLS: Record<NodeStatus, string> = {
  pending: '☐',
  completed: '✓',
  abandoned: '✗',
};

export interface TransientMetadata {
  isCut?: boolean;
}

/**
 * Built-in metadata keys used across the renderer. Keep this in sync with
 * renderer-side type literals like StepType (the strings below are their
 * source of truth — renderer re-imports these types).
 *
 * The `[key: string]: unknown` index signature stays so plugin-added keys
 * and future extensions compile without touching this file.
 */
export interface NodeMetadata {
  // Core
  status?: NodeStatus;
  expanded?: boolean;
  created?: string;
  updated?: string;
  resolvedAt?: string;

  // Blueprint / context visuals
  isBlueprint?: boolean;
  blueprintIcon?: string;
  blueprintColor?: string;
  isContextDeclaration?: boolean;
  collaborate?: boolean;
  execute?: boolean;

  // Context application
  appliedContextId?: string;
  appliedContextIds?: string[];
  activeContextId?: string;

  // Workflow
  isWorkflow?: boolean;
  stepType?: 'manual' | 'checkpoint' | 'autonomous';
  decomposition?: boolean;
  recurse?: boolean;
  nextStepContext?: boolean;
  clearSession?: boolean;

  // Session lifecycle
  sessionId?: string;
  brokenChain?: boolean;

  // Archive / step settings
  archiveDestinationId?: string;
  archiveSideLinkName?: string;
  replacementSideLinkName?: string;
  resolveLinkedContent?: boolean;

  // Hyperlinks / external
  isHyperlink?: boolean;
  linkedNodeId?: string;
  externalUrl?: string;

  // Feedback / collaboration
  feedbackTempFile?: string;
  feedbackBaselineKind?: 'unchanged' | 'modified' | 'added' | 'removed';
  feedbackPriorContent?: string;

  // Plugin + transient extension
  plugins?: Record<string, Record<string, unknown>>;
  transient?: TransientMetadata;

  // Escape hatch for unknown / plugin-added keys.
  [key: string]: unknown;
}

export interface TreeNode {
  id: string;
  content: string;
  children: string[];
  metadata: NodeMetadata;
}
