import React, { useState } from 'react';
import { NodeContent } from '../NodeContent';
import { useTreeStore } from '../../store/treeStore';

interface NodeProps {
  nodeId: string;
  depth?: number;
}

export function Node({ nodeId, depth = 0 }: NodeProps) {
  const node = useTreeStore((state) => state.nodes[nodeId]);
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
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((childId) => (
          <Node
            key={childId}
            nodeId={childId}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
