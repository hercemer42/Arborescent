import React from 'react';
import { Node, NodeTypeConfig } from '../types';
import { ExpandToggle } from './ui/ExpandToggle';
import { StatusCheckbox } from './ui/StatusCheckbox';
import { componentStyles } from '../design/theme';

interface NodeContentProps {
  node: Node;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}

export function NodeContent({
  node,
  nodeTypeConfig,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
  isSelected,
}: NodeContentProps) {
  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };

  return (
    <div
      className={`${componentStyles.node.base} ${isSelected ? componentStyles.node.selected : ''}`}
      onClick={onSelect}
    >
      {hasChildren ? (
        <ExpandToggle expanded={expanded} onToggle={onToggle} />
      ) : (
        <span className="w-4 h-4"></span>
      )}

      {node.type === 'task' && <StatusCheckbox status={node.metadata.status} />}

      {config.icon && <span className={componentStyles.icon.base}>{config.icon}</span>}

      <span className={config.style}>{node.content}</span>
    </div>
  );
}
