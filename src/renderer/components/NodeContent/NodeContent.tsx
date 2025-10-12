import { memo } from 'react';
import { TreeNode } from '../../../shared/types';
import { ExpandToggle } from '../ui/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { useNodeContent } from './useNodeContent';
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
    config,
    hasChildren,
    isSelected,
    updateStatus,
    contentRef,
    handleKeyDown,
    handleInput,
  } = useNodeContent(node);

  return (
    <div
      className={`node-content ${isSelected ? 'selected' : ''}`}
    >
      {hasChildren && <ExpandToggle expanded={expanded} onToggle={onToggle} />}

      {node.type === 'task' && (
        <StatusCheckbox
          status={node.metadata.status}
          onChange={(status) => updateStatus(node.id, status)}
        />
      )}

      {config.icon && (
        <span
          className="node-icon"
          onMouseDown={(e) => e.preventDefault()}
        >
          {config.icon}
        </span>
      )}

      <div
        ref={contentRef}
        className="node-text"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
    </div>
  );
});
