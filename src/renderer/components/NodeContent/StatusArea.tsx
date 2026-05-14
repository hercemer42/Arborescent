import type { MouseEvent } from 'react';
import { createElement } from 'react';
import { AlertCircle, Asterisk, Cog, Link, Pause, Play } from 'lucide-react';
import type { TreeNode, NodeStatus } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import type { LucideIcon } from '../ui/CustomizeDialog/CustomizeDialog';
import { useStepConfigDialogStore } from '../../store/stepConfigDialog/stepConfigDialogStore';
import { getStepTypeLabel } from './hooks/useWorkflowIndicator';

export type ExecutionState = 'running' | 'awaiting-validation' | 'stuck' | null;
export type StepType = 'manual' | 'checkpoint' | 'autonomous';

interface WorkflowOverlayProps {
  executionState: ExecutionState;
  onStop: () => void;
  onResume: () => void;
}

function WorkflowOverlay({ executionState, onStop, onResume }: WorkflowOverlayProps) {
  if (executionState === 'running') {
    return (
      <button
        className="workflow-execution-overlay running"
        title="Running — click to stop"
        aria-label="Stop workflow"
        onClick={(e) => {
          e.stopPropagation();
          onStop();
        }}
      >
        <Play size={16} fill="currentColor" />
      </button>
    );
  }
  if (executionState === 'awaiting-validation') {
    return (
      <span
        className="workflow-execution-overlay paused"
        title="Awaiting validation"
        aria-label="Workflow awaiting validation"
      >
        <Pause size={16} fill="currentColor" />
      </span>
    );
  }
  if (executionState === 'stuck') {
    return (
      <button
        className="workflow-execution-overlay stuck"
        title="Stuck — click to resume"
        aria-label="Resume stuck workflow"
        onClick={(e) => {
          e.stopPropagation();
          onResume();
        }}
      >
        <AlertCircle size={16} fill="currentColor" />
      </button>
    );
  }
  return null;
}

interface StatusAreaProps {
  node: TreeNode;
  isLink: boolean;
  isExternalLink: boolean;
  navigateToLinkedNode: () => void;
  isContextDeclaration: boolean;
  isContextChild: boolean;
  ContextIcon: LucideIcon | null | undefined;
  contextColor: string | undefined;
  BlueprintIcon: LucideIcon;
  blueprintColor: string | undefined;
  isInheritingBlueprintIcon: boolean;
  isWorkflow: boolean;
  stepNumber: number | null;
  stepType: StepType;
  executionState: ExecutionState;
  onBlueprintIconClick: (e: MouseEvent) => void;
  onContextIconClick: (e: MouseEvent) => void;
  onToggleStatus: (nodeId: string) => void;
  onStopWorkflow: () => void;
  onResumeStuckNode: () => void;
}

/**
 * Dispatches to one of five visual states for a node's status area:
 *   link | context-declaration | context-child | blueprint | checkbox.
 *
 * Split out of NodeContent so the five branches (previously 130+ lines of
 * inline JSX inside a `renderStatusArea` IIFE) are legible in isolation.
 */
export function StatusArea({
  node,
  isLink,
  isExternalLink,
  navigateToLinkedNode,
  isContextDeclaration,
  isContextChild,
  ContextIcon,
  contextColor,
  BlueprintIcon,
  blueprintColor,
  isInheritingBlueprintIcon,
  isWorkflow,
  stepNumber,
  stepType,
  executionState,
  onBlueprintIconClick,
  onContextIconClick,
  onToggleStatus,
  onStopWorkflow,
  onResumeStuckNode,
}: StatusAreaProps) {
  if (isLink) {
    const title = isExternalLink
      ? 'Click to open in browser panel'
      : 'Click to navigate to linked branch';
    return (
      <button
        className="hyperlink-indicator"
        title={title}
        onClick={navigateToLinkedNode}
      >
        <Link size={19} />
      </button>
    );
  }

  if (isContextDeclaration && ContextIcon) {
    return (
      <span className="context-icon-wrapper">
        <button
          className="context-indicator context-declaration"
          title="Click to change icon"
          onClick={onContextIconClick}
          style={contextColor ? { color: contextColor } : undefined}
        >
          {createElement(ContextIcon, { size: 19 })}
        </button>
        <span className="context-declaration-overlay">
          <Asterisk size={18} strokeWidth={1} />
        </span>
      </span>
    );
  }

  if (isContextChild && ContextIcon) {
    return (
      <span
        className="context-indicator context-child"
        style={contextColor ? { color: contextColor } : undefined}
      >
        {createElement(ContextIcon, { size: 19 })}
      </span>
    );
  }

  if (node.metadata.isBlueprint) {
    const blueprintClass = isInheritingBlueprintIcon
      ? 'blueprint-indicator blueprint-inherited'
      : 'blueprint-indicator';
    return (
      <span className="blueprint-icon-wrapper">
        <button
          className={blueprintClass}
          title="Click to change icon"
          onClick={onBlueprintIconClick}
          style={blueprintColor ? { color: blueprintColor } : undefined}
        >
          {createElement(BlueprintIcon, { size: 19 })}
        </button>
        {isWorkflow && (
          <span className="workflow-indicator">
            <Cog size={19} strokeWidth={1} />
          </span>
        )}
        {stepNumber !== null && (
          <span
            className={`workflow-step-number step-type-${stepType}`}
            title={`Step ${stepNumber} (${getStepTypeLabel(stepType)})`}
            onClick={(e) => {
              e.stopPropagation();
              useStepConfigDialogStore.getState().open(node.id);
            }}
          >
            {stepNumber}
          </span>
        )}
        <WorkflowOverlay executionState={executionState} onStop={onStopWorkflow} onResume={onResumeStuckNode} />
      </span>
    );
  }

  return (
    <span className="checkbox-icon-wrapper">
      <StatusCheckbox
        status={node.metadata.status as NodeStatus | undefined}
        onToggle={() => onToggleStatus(node.id)}
      />
      <WorkflowOverlay executionState={executionState} onStop={onStopWorkflow} onResume={onResumeStuckNode} />
    </span>
  );
}
