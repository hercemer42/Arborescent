import React from 'react';
import { Node } from '../../../shared/types';
import { ExpandToggle } from '../ui/ExpandToggle/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox/StatusCheckbox';
import { useNodeContent } from './useNodeContent';
import './NodeContent.css';

interface NodeContentProps {
  node: Node;
  expanded: boolean;
  onToggle: () => void;
}

export function NodeContent({
  node,
  expanded,
  onToggle,
}: NodeContentProps) {
  const {
    config,
    hasChildren,
    isSelected,
    isEditing,
    handleClick,
    updateStatus,
    editValue,
    setEditValue,
    inputRef,
    handleKeyDown,
    handleBlur,
  } = useNodeContent(node);

  return (
    <div
      className={`node-content ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      {hasChildren && <ExpandToggle expanded={expanded} onToggle={onToggle} />}

      {node.type === 'task' && (
        <StatusCheckbox
          status={node.metadata.status}
          onChange={(status) => updateStatus(node.id, status)}
        />
      )}

      {config.icon && <span className="node-icon">{config.icon}</span>}

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="node-text-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      ) : (
        <span className="node-text">{node.content}</span>
      )}
    </div>
  );
}
