import { useState } from 'react';
import { NodeContent } from '../NodeContent';
import { useTreeStore } from '../../store/treeStore';

interface NodeProps {
  nodeId: string;
  depth?: number;
}

export function Node({ nodeId, depth = 0 }: NodeProps) {
  const node = useTreeStore((state) => state.nodes[nodeId]);
  const nodes = useTreeStore((state) => state.nodes);
  const selectedNodeId = useTreeStore((state) => state.selectedNodeId);
  const selectNode = useTreeStore((state) => state.actions.selectNode);
  const refocus = useTreeStore((state) => state.actions.refocus);
  const [expanded, setExpanded] = useState(true);

  if (!node) {
    return null;
  }

  const hasChildren = node.children.length > 0;

  const isDescendant = (parentId: string, targetId: string | null): boolean => {
    if (!targetId) return false;
    if (parentId === targetId) return false;

    const parent = nodes[parentId];
    if (!parent) return false;

    for (const childId of parent.children) {
      if (childId === targetId) return true;
      if (isDescendant(childId, targetId)) return true;
    }
    return false;
  };

  const handleToggle = () => {
    const newExpandedState = !expanded;

    if (!newExpandedState && isDescendant(nodeId, selectedNodeId)) {
      selectNode(nodeId, node.content.length);
    } else if (selectedNodeId) {
      refocus();
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
