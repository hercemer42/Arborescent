import { useState } from 'react';
import { NodeContent } from '../NodeContent';
import { useTreeStore } from '../../store/treeStore';
import { isDescendant as checkIsDescendant } from '../../services/registryService';

interface NodeProps {
  nodeId: string;
  depth?: number;
}

export function Node({ nodeId, depth = 0 }: NodeProps) {
  const node = useTreeStore((state) => state.nodes[nodeId]);
  const ancestorRegistry = useTreeStore((state) => state.ancestorRegistry);
  const selectedNodeId = useTreeStore((state) => state.selectedNodeId);
  const selectNode = useTreeStore((state) => state.actions.selectNode);
  const [expanded, setExpanded] = useState(true);

  if (!node) {
    return null;
  }

  const hasChildren = node.children.length > 0;

  const handleToggle = () => {
    const newExpandedState = !expanded;

    if (!newExpandedState && checkIsDescendant(nodeId, selectedNodeId, ancestorRegistry)) {
      selectNode(nodeId, node.content.length);
    }

    setExpanded(newExpandedState);
  };

  return (
    <div>
      <div style={{ paddingLeft: `${depth * 20}px` }}>
        <NodeContent
          node={node}
          expanded={expanded}
          onToggle={handleToggle}
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
