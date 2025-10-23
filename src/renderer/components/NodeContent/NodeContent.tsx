import { memo } from 'react';
import { TreeNode } from '../../../shared/types';
import { ExpandToggle } from '../ui/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import './NodeContent.css';

interface NodeContentProps {
  node: TreeNode;
  expanded: boolean;
  onToggle: () => void;
}

export const NodeContent = memo(function NodeContent({
  node,
  expanded,
  onToggle,
}: NodeContentProps) {
  const {
    hasChildren,
    isSelected,
    updateStatus,
    contentRef,
    handleKeyDown,
    handleMouseDown,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  } = useNodeContent(node);

  return (
    <>
      <div
        className={`node-content ${isSelected ? 'selected' : ''}`}
        onContextMenu={handleContextMenu}
      >
        {hasChildren && <ExpandToggle expanded={expanded} onToggle={onToggle} />}

        <StatusCheckbox
          status={node.metadata.status}
          onChange={(status) => updateStatus(node.id, status)}
        />

        <div
          ref={contentRef}
          className="node-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
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
});
