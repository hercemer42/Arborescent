import { memo, createElement } from 'react';
import { Asterisk, Cog, Link, Pause, Play } from 'lucide-react';
import { TreeNode } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import { useBlueprintIconClick } from './hooks/useBlueprintIconClick';
import { useContextIconClick } from './hooks/useContextIconClick';
import { useContextIcon } from './hooks/useContextIcon';
import { useBlueprintIcon } from './hooks/useBlueprintIcon';
import { useHyperlinkNavigation } from './hooks/useHyperlinkNavigation';
import { useSearchHighlight } from './hooks/useSearchHighlight';
import { useWorkflowIndicator, getStepTypeLabel } from './hooks/useWorkflowIndicator';
import { useStepConfigDialogStore } from '../../store/stepConfigDialog/stepConfigDialogStore';
import { useWorkflowExecutionOverlay } from './hooks/useWorkflowExecutionOverlay';
import './NodeContent.css';

interface NodeContentProps {
  node: TreeNode;
  depth: number;
}

function NodeContentComponent({
  node,
  depth,
}: NodeContentProps) {
  const {
    isSelected,
    toggleStatus,
    setContentRef,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  } = useNodeContent(node);

  const handleBlueprintIconClick = useBlueprintIconClick(node.id, node);
  const handleContextIconClick = useContextIconClick(node.id, node);
  const { navigateToLinkedNode, isExternalLink } = useHyperlinkNavigation(node);

  const { isContextDeclaration, isContextChild, ContextIcon, contextColor } = useContextIcon(node);
  const { BlueprintIcon, blueprintColor, isInherited: isInheritingBlueprintIcon } = useBlueprintIcon(node);
  const { isWorkflow, stepNumber, stepType } = useWorkflowIndicator(node);
  const { executionState, stopWorkflow } = useWorkflowExecutionOverlay(node);

  const isHyperlink = node.metadata.isHyperlink === true;
  const isLink = isHyperlink || isExternalLink;

  // Search highlighting
  const { highlightedContent } = useSearchHighlight(node.id, node.content, isSelected);

  // Render the status area (checkbox, blueprint icon, context icon, or hyperlink icon)
  const renderStatusArea = () => {
    // Link node (internal hyperlink or external URL)
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
            onClick={handleContextIconClick}
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

    // Context child - non-clickable icon at reduced opacity
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

    // Blueprint node - clickable icon
    if (node.metadata.isBlueprint) {
      const blueprintClass = isInheritingBlueprintIcon
        ? 'blueprint-indicator blueprint-inherited'
        : 'blueprint-indicator';
      return (
        <span className="blueprint-icon-wrapper">
          <button
            className={blueprintClass}
            title="Click to change icon"
            onClick={handleBlueprintIconClick}
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
          {executionState === 'running' && (
            <button
              className="workflow-execution-overlay running"
              title="Running — click to stop"
              aria-label="Stop workflow"
              onClick={(e) => {
                e.stopPropagation();
                stopWorkflow();
              }}
            >
              <Play size={16} fill="currentColor" />
            </button>
          )}
          {executionState === 'awaiting-validation' && (
            <span
              className="workflow-execution-overlay paused"
              title="Awaiting validation"
              aria-label="Workflow awaiting validation"
            >
              <Pause size={16} fill="currentColor" />
            </span>
          )}
        </span>
      );
    }

    // Regular node - checkbox
    return (
      <span className="checkbox-icon-wrapper">
        <StatusCheckbox
          status={node.metadata.status}
          onToggle={() => toggleStatus(node.id)}
        />
        {executionState === 'running' && (
          <button
            className="workflow-execution-overlay running"
            title="Running — click to stop"
            aria-label="Stop workflow"
            onClick={(e) => {
              e.stopPropagation();
              stopWorkflow();
            }}
          >
            <Play size={16} fill="currentColor" />
          </button>
        )}
        {executionState === 'awaiting-validation' && (
          <span
            className="workflow-execution-overlay paused"
            title="Awaiting validation"
            aria-label="Workflow awaiting validation"
          >
            <Pause size={16} fill="currentColor" />
          </span>
        )}
      </span>
    );
  };

  return (
    <>
      <div
        className={`node-content ${isSelected ? 'selected' : ''}`}
        onContextMenu={handleContextMenu}
        style={{
          paddingLeft: `${(depth * 20) + 15}px`,
          '--indent-width': `${depth * 20}px`,
        } as React.CSSProperties}
      >
        <div className={`status-checkbox-wrapper ${!isSelected ? 'not-selected' : ''}`}>
          {renderStatusArea()}
        </div>

        {highlightedContent ? (
          // Non-editable highlighted content when search is active
          <div
            className={`node-text ${isLink ? 'hyperlink-text' : ''}`}
            onClick={isLink ? navigateToLinkedNode : undefined}
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        ) : (
          // Editable content when no search or node is selected
          <div
            ref={setContentRef}
            className={`node-text ${isLink ? 'hyperlink-text' : ''}`}
            contentEditable={!isLink}
            suppressContentEditableWarning
            spellCheck={!isLink}
            onInput={isLink ? undefined : handleInput}
            onClick={isLink ? navigateToLinkedNode : undefined}
          />
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
}

export const NodeContent = memo(NodeContentComponent);
