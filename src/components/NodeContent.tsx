import React from 'react';
import { Node, NodeTypeConfig } from '../types';

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
  const statusIcon = node.metadata.status || '';
  const config = nodeTypeConfig[node.type] || { icon: '', style: '' };
  const typeIcon = config.icon;
  const expandIcon = hasChildren ? (expanded ? '▼' : '▶') : '  ';

  return (
    <div
      className={`
        flex items-center gap-2 py-1 px-2 rounded cursor-pointer
        hover:bg-gray-100 transition-colors
        ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}
      `}
      onClick={onSelect}
    >
      {/* Expand/collapse button */}
      <button
        className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700"
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            onToggle();
          }
        }}
      >
        <span className="text-xs">{expandIcon}</span>
      </button>

      {/* Status icon for tasks */}
      {node.type === 'task' && (
        <span className="text-sm">{statusIcon}</span>
      )}

      {/* Type icon */}
      {typeIcon && <span className="text-sm">{typeIcon}</span>}

      {/* Node content */}
      <span className={config.style}>{node.content}</span>
    </div>
  );
}
