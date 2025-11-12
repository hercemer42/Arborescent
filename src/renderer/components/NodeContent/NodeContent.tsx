import { memo } from 'react';
import { TreeNode } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
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
        style={{ paddingLeft: `${(depth * 20) + 15}px` }}
      >
        <div className={`status-checkbox-wrapper ${!isSelected ? 'not-selected' : ''}`}>
          <StatusCheckbox
            status={node.metadata.status}
            onToggle={() => toggleStatus(node.id)}
          />
        </div>

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
}

export const NodeContent = memo(NodeContentComponent);
