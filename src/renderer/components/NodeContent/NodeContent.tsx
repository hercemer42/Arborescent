import React from 'react';
import { Node, NodeTypeConfig, NodeStatus } from '../../../shared/types';
import { ExpandToggle } from '../ui/ExpandToggle/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox/StatusCheckbox';
import './NodeContent.css';

interface NodeContentProps {
  node: Node;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onStatusChange?: (nodeId: string, status: NodeStatus) => void;
  isSelected: boolean;
}

export function NodeContent({
  node,
  nodeTypeConfig,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
  onStatusChange,
  isSelected,
}: NodeContentProps) {
  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };

  return (
    <div
      className={`node-content ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {hasChildren && <ExpandToggle expanded={expanded} onToggle={onToggle} />}

      {node.type === 'task' && (
        <StatusCheckbox
          status={node.metadata.status}
          onChange={(status) => onStatusChange?.(node.id, status)}
        />
      )}

      {config.icon && <span className="node-icon">{config.icon}</span>}

      <span className="node-text">{node.content}</span>
    </div>
  );
}
