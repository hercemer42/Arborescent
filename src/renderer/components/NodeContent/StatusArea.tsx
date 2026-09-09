import type { MouseEvent } from 'react';
import { createElement } from 'react';
import { Asterisk, Cog, Link, Pause, Play, Unlink } from 'lucide-react';
import type { TreeNode, NodeStatus } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import type { LucideIcon } from '../ui/CustomizeDialog/CustomizeDialog';
import { useStepConfigDialogStore } from '../../store/stepConfigDialog/stepConfigDialogStore';
import { getStepTypeLabel } from './hooks/useWorkflowIndicator';
import { getWeightBand } from '../../utils/findings';

export type ExecutionState = 'running' | 'awaiting-validation' | null;
export type StepType = 'manual' | 'checkpoint' | 'autonomous';

interface WorkflowOverlayProps {
  executionState: ExecutionState;
  onStop: () => void;
  onUnpause: () => void;
}

function WorkflowOverlay({ executionState, onStop, onUnpause }: WorkflowOverlayProps) {
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
      <button
        className="workflow-execution-overlay paused"
        title="Paused — click to unpause"
        aria-label="Unpause workflow"
        onClick={(e) => {
          e.stopPropagation();
          onUnpause();
        }}
      >
        <Pause size={16} fill="currentColor" />
      </button>
    );
  }
  return null;
}

interface BrokenChainIndicatorProps {
  broken: boolean;
}

function BrokenChainIndicator({ broken }: BrokenChainIndicatorProps) {
  if (!broken) return null;
  return (
    <span
      className="broken-chain-indicator"
      title="Session link broken — re-send this node to reconnect"
      aria-label="Session link broken"
    >
      <Unlink size={14} />
    </span>
  );
}

// The badge takes the checkbox's position rather than sitting beside it, the
// same substitution a workflow step number already makes. Colour carries the
// recurrence signal, so the label carries it too.
function FindingWeightBadge({ weight }: { weight: number }) {
  return (
    <span
      className={`finding-weight-badge weight-band-${getWeightBand(weight)}`}
      aria-label={`Weight ${weight}`}
      title={`Seen ${weight} time${weight === 1 ? '' : 's'}`}
    >
      {weight}
    </span>
  );
}

interface StatusAreaProps {
  node: TreeNode;
  isLink: boolean;
  isExternalLink: boolean;
  navigateToLinkedNode: () => void;
  isContextDeclaration: boolean;
  isContextChild: boolean;
  findingWeight: number | null;
  ContextIcon: LucideIcon | null | undefined;
  contextColor: string | undefined;
  BlueprintIcon: LucideIcon;
  blueprintColor: string | undefined;
  isInheritingBlueprintIcon: boolean;
  isWorkflow: boolean;
  isInsideWorkflow: boolean;
  stepNumber: number | null;
  stepType: StepType;
  executionState: ExecutionState;
  onBlueprintIconClick: (e: MouseEvent) => void;
  onContextIconClick: (e: MouseEvent) => void;
  onToggleStatus: (nodeId: string) => void;
  onStopWorkflow: () => void;
  onUnpauseWorkflow: () => void;
}

/**
 * Dispatches to one of six visual states for a node's status area:
 *   link | finding-weight | context-declaration | context-child | blueprint |
 *   checkbox.
 *
 * Split out of NodeContent so the branches (previously 130+ lines of
 * inline JSX inside a `renderStatusArea` IIFE) are legible in isolation.
 */
export function StatusArea({
  node,
  isLink,
  isExternalLink,
  navigateToLinkedNode,
  isContextDeclaration,
  isContextChild,
  findingWeight,
  ContextIcon,
  contextColor,
  BlueprintIcon,
  blueprintColor,
  isInheritingBlueprintIcon,
  isWorkflow,
  isInsideWorkflow,
  stepNumber,
  stepType,
  executionState,
  onBlueprintIconClick,
  onContextIconClick,
  onToggleStatus,
  onStopWorkflow,
  onUnpauseWorkflow,
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

  // Ahead of the context and blueprint branches, which return early: a finding
  // inheriting either would otherwise render an icon and hide its weight.
  if (findingWeight !== null) {
    return (
      <span className="checkbox-icon-wrapper">
        <FindingWeightBadge weight={findingWeight} />
        <WorkflowOverlay executionState={executionState} onStop={onStopWorkflow} onUnpause={onUnpauseWorkflow} />
        <BrokenChainIndicator broken={node.metadata.brokenChain === true} />
      </span>
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
    const isWorkflowStep = isInsideWorkflow && !isWorkflow;
    const blueprintClass = isInheritingBlueprintIcon
      ? 'blueprint-indicator blueprint-inherited'
      : 'blueprint-indicator';
    return (
      <span className="blueprint-icon-wrapper">
        {!isWorkflowStep && (
          <button
            className={blueprintClass}
            title="Click to change icon"
            onClick={onBlueprintIconClick}
            style={blueprintColor ? { color: blueprintColor } : undefined}
          >
            {createElement(BlueprintIcon, { size: 19 })}
          </button>
        )}
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
        <WorkflowOverlay executionState={executionState} onStop={onStopWorkflow} onUnpause={onUnpauseWorkflow} />
        <BrokenChainIndicator broken={node.metadata.brokenChain === true} />
      </span>
    );
  }

  return (
    <span className="checkbox-icon-wrapper">
      <StatusCheckbox
        status={node.metadata.status as NodeStatus | undefined}
        onToggle={() => onToggleStatus(node.id)}
      />
      <WorkflowOverlay executionState={executionState} onStop={onStopWorkflow} onUnpause={onUnpauseWorkflow} />
      <BrokenChainIndicator broken={node.metadata.brokenChain === true} />
    </span>
  );
}
