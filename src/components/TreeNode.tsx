import React, { useState } from 'react';
import { Node, NodeTypeConfig } from '../types';
import { NodeContent } from './NodeContent';

interface TreeNodeProps {
  nodeId: string;
  nodes: Record<string, Node>;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  depth?: number;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function TreeNode({
  nodeId,
  nodes,
  nodeTypeConfig,
  depth = 0,
  selectedNodeId,
  onSelectNode,
}: TreeNodeProps) {
  const node = nodes[nodeId];
  const [expanded, setExpanded] = useState(true);

  if (!node) {
    return null;
  }

  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div style={{ paddingLeft: `${depth * 20}px` }}>
        <NodeContent
          node={node}
          nodeTypeConfig={nodeTypeConfig}
          expanded={expanded}
          hasChildren={hasChildren}
          onToggle={() => setExpanded(!expanded)}
          onSelect={() => onSelectNode(nodeId)}
          isSelected={selectedNodeId === nodeId}
        />
      </div>

      {/* Recursive children */}
      {expanded &&
        hasChildren &&
        node.children.map((childId) => (
          <TreeNode
            key={childId}
            nodeId={childId}
            nodes={nodes}
            nodeTypeConfig={nodeTypeConfig}
            depth={depth + 1}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
    </div>
  );
}
