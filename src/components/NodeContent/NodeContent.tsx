import React from 'react';
import { Node, NodeTypeConfig } from '../../types';
import { ExpandToggle } from '../ui/ExpandToggle/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox/StatusCheckbox';
import { styles } from './NodeContent.styles';

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
      className={`${styles.base} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      {hasChildren ? (
        <ExpandToggle expanded={expanded} onToggle={onToggle} />
      ) : (
        <span className={styles.spacer}></span>
      )}

      {node.type === 'task' && <StatusCheckbox status={node.metadata.status} />}

      {config.icon && <span className={styles.icon}>{config.icon}</span>}

      <span className={config.style}>{node.content}</span>
    </div>
  );
}
