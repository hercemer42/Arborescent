import { useState, memo } from 'react';
import { NodeContent } from '../NodeContent';
import { useTreeStore } from '../../store/treeStore';
import { isDescendant as checkIsDescendant } from '../../services/registryService';
import './TreeNode.css';

interface TreeNodeProps {
  nodeId: string;
  depth?: number;
}

export const TreeNode = memo(function TreeNode({ nodeId, depth = 0 }: TreeNodeProps) {
  const node = useTreeStore((state) => state.nodes[nodeId]);
  const [expanded, setExpanded] = useState(true);
  const isSelected = useTreeStore((state) => state.selectedNodeId === nodeId);

  if (!node) {
    return null;
  }

  const hasChildren = node.children.length > 0;

  const handleToggle = () => {
    const newExpandedState = !expanded;

    if (!newExpandedState) {
      const { selectedNodeId, ancestorRegistry, actions } = useTreeStore.getState();
      if (checkIsDescendant(nodeId, selectedNodeId, ancestorRegistry)) {
        actions.selectNode(nodeId, node.content.length);
      }
    }

    setExpanded(newExpandedState);
  };

  return (
    <>
      <div
        className={`tree-node-wrapper ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        <NodeContent
          node={node}
          expanded={expanded}
          onToggle={handleToggle}
        />
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((childId) => (
          <TreeNode
            key={childId}
            nodeId={childId}
            depth={depth + 1}
          />
        ))}
    </>
  );
});
