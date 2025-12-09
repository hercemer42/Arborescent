import { memo, createElement } from 'react';
import { Link } from 'lucide-react';
import { TreeNode } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import { useBlueprintIconClick } from './hooks/useBlueprintIconClick';
import { useContextIconClick } from './hooks/useContextIconClick';
import { useContextIcon } from './hooks/useContextIcon';
import { useBlueprintIcon } from './hooks/useBlueprintIcon';
import { useHyperlinkNavigation } from './hooks/useHyperlinkNavigation';
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
    contentRef,
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

  const isHyperlink = node.metadata.isHyperlink === true;
  const isLink = isHyperlink || isExternalLink;

  // Render the status area (checkbox, blueprint icon, context icon, or hyperlink icon)
  const renderStatusArea = () => {
    // Link node (internal hyperlink or external URL)
    if (isLink) {
      const title = isExternalLink ? 'Click to open in browser' : 'Click to navigate to linked node';
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

    // Context declaration - clickable icon (no badge - badge is only in gutter)
    if (isContextDeclaration && ContextIcon) {
      return (
        <button
          className="context-indicator context-declaration"
          title="Click to change icon"
          onClick={handleContextIconClick}
          style={contextColor ? { color: contextColor } : undefined}
        >
          {createElement(ContextIcon, { size: 19 })}
        </button>
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
        <button
          className={blueprintClass}
          title="Click to change icon"
          onClick={handleBlueprintIconClick}
          style={blueprintColor ? { color: blueprintColor } : undefined}
        >
          {createElement(BlueprintIcon, { size: 19 })}
        </button>
      );
    }

    // Regular node - checkbox
    return (
      <StatusCheckbox
        status={node.metadata.status}
        onToggle={() => toggleStatus(node.id)}
      />
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

        <div
          ref={contentRef}
          className={`node-text ${isLink ? 'hyperlink-text' : ''}`}
          contentEditable={!isLink}
          suppressContentEditableWarning
          spellCheck={isSelected}
          onInput={isLink ? undefined : handleInput}
          onClick={isLink ? navigateToLinkedNode : undefined}
        />
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
