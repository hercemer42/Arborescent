import { memo, createElement } from 'react';
import { Boxes } from 'lucide-react';
import { TreeNode } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import { useBlueprintIconClick } from './hooks/useBlueprintIconClick';
import { useContextIconClick } from './hooks/useContextIconClick';
import { getIconByName } from '../ui/IconPicker/IconPicker';
import { DEFAULT_BLUEPRINT_ICON } from '../../store/tree/actions/blueprintActions';
import { useStore } from '../../store/tree/useStore';
import { getContextDeclarationId } from '../../utils/nodeHelpers';
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

  // Determine if this node is part of a context declaration tree
  const contextDeclarationId = getContextDeclarationId(node);
  const isContextDeclaration = node.metadata.isContextDeclaration === true;
  const isContextChild = node.metadata.isContextChild === true;

  // Get context icon/color - either from the node itself (if declaration) or from parent
  const contextParentNode = useStore((state) => {
    if (isContextDeclaration) return node;
    if (isContextChild && contextDeclarationId) {
      return state.nodes[contextDeclarationId];
    }
    return undefined;
  });

  const contextIcon = contextParentNode?.metadata.contextIcon as string | undefined;
  const contextColor = contextParentNode?.metadata.contextColor as string | undefined;
  const ContextIcon = contextIcon ? getIconByName(contextIcon) : undefined;

  const blueprintIconName = (node.metadata.blueprintIcon as string) || DEFAULT_BLUEPRINT_ICON;
  const blueprintColor = node.metadata.blueprintColor as string | undefined;
  const BlueprintIcon = getIconByName(blueprintIconName) || Boxes;

  // Render the status area (checkbox, blueprint icon, or context icon)
  const renderStatusArea = () => {
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
      return (
        <button
          className="blueprint-indicator"
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
          className="node-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={handleInput}
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
