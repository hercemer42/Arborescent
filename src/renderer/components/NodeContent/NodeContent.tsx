import { memo } from 'react';
import { TreeNode } from '../../../shared/types';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import { useBlueprintIconClick } from './hooks/useBlueprintIconClick';
import { useContextIconClick } from './hooks/useContextIconClick';
import { useContextIcon } from './hooks/useContextIcon';
import { useBlueprintIcon } from './hooks/useBlueprintIcon';
import { useHyperlinkNavigation } from './hooks/useHyperlinkNavigation';
import { useSearchHighlight } from './hooks/useSearchHighlight';
import { useWorkflowIndicator } from './hooks/useWorkflowIndicator';
import { useWorkflowExecutionOverlay } from './hooks/useWorkflowExecutionOverlay';
import { useRichNodeContent } from './hooks/useRichNodeContent';
import { StatusArea } from './StatusArea';
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
  const { isWorkflow, isInsideWorkflow, stepNumber, stepType } = useWorkflowIndicator(node);
  const { executionState, stopWorkflow } = useWorkflowExecutionOverlay(node);

  const isHyperlink = node.metadata.isHyperlink === true;
  const isLink = isHyperlink || isExternalLink;

  const { highlightedContent } = useSearchHighlight(node.id, node.content, isSelected);

  const { richHtml, handleRichClick } = useRichNodeContent(node, {
    isLink,
    isSelected,
    hasHighlightedContent: Boolean(highlightedContent),
  });

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
          <StatusArea
            node={node}
            isLink={isLink}
            isExternalLink={isExternalLink}
            navigateToLinkedNode={navigateToLinkedNode}
            isContextDeclaration={isContextDeclaration}
            isContextChild={isContextChild}
            ContextIcon={ContextIcon}
            contextColor={contextColor}
            BlueprintIcon={BlueprintIcon}
            blueprintColor={blueprintColor}
            isInheritingBlueprintIcon={isInheritingBlueprintIcon}
            isWorkflow={isWorkflow}
            isInsideWorkflow={isInsideWorkflow}
            stepNumber={stepNumber}
            stepType={stepType}
            executionState={executionState}
            onBlueprintIconClick={handleBlueprintIconClick}
            onContextIconClick={handleContextIconClick}
            onToggleStatus={toggleStatus}
            onStopWorkflow={stopWorkflow}
          />
        </div>

        {highlightedContent ? (
          <div
            className={`node-text ${isLink ? 'hyperlink-text' : ''}`}
            onClick={isLink ? navigateToLinkedNode : undefined}
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        ) : richHtml ? (
          <div
            className="node-text"
            onClick={handleRichClick}
            dangerouslySetInnerHTML={{ __html: richHtml }}
          />
        ) : (
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
