import React from 'react';
import { Node, NodeTypeConfig, NodeStatus } from '../../../shared/types';
import { ExpandToggle } from '../ui/ExpandToggle/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox/StatusCheckbox';
import { useNodeEdit } from './edit.hook';
import './NodeContent.css';

interface NodeContentProps {
  node: Node;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onStatusChange?: (nodeId: string, status: NodeStatus) => void;
  onContentChange?: (nodeId: string, content: string) => void;
  isSelected: boolean;
  isEditing: boolean;
  onStartEdit?: () => void;
  onFinishEdit?: () => void;
}

export function NodeContent({
  node,
  nodeTypeConfig,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
  onStatusChange,
  onContentChange,
  isSelected,
  isEditing,
  onStartEdit,
  onFinishEdit,
}: NodeContentProps) {
  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };

  const { editValue, setEditValue, inputRef, handleKeyDown, handleBlur } = useNodeEdit(
    node.content,
    isEditing,
    (value) => {
      onContentChange?.(node.id, value);
      onFinishEdit?.();
    },
    () => onFinishEdit?.()
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    if (isSelected && !isEditing) {
      onStartEdit?.();
    }
  };

  return (
    <div
      className={`node-content ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      {hasChildren && <ExpandToggle expanded={expanded} onToggle={onToggle} />}

      {node.type === 'task' && (
        <StatusCheckbox
          status={node.metadata.status}
          onChange={(status) => onStatusChange?.(node.id, status)}
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
