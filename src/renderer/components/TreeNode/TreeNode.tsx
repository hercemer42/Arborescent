import { memo } from 'react';
import { NodeContent } from '../NodeContent';
import { useStore } from '../../store/tree/useStore';
import { useActiveTreeStore } from '../../store/tree/TreeStoreContext';
import { isDescendant as checkIsDescendant } from '../../utils/ancestry';
import { useNodeMouse } from './hooks/useNodeMouse';
import './TreeNode.css';

interface TreeNodeProps {
  nodeId: string;
  depth?: number;
}

export const TreeNode = memo(function TreeNode({ nodeId, depth = 0 }: TreeNodeProps) {
  const node = useStore((state) => state.nodes[nodeId]);
  const isSelected = useStore((state) => state.selectedNodeId === nodeId);
  const { handleMouseDown, handleMouseMove, handleClick } = useNodeMouse(nodeId);
  const store = useActiveTreeStore();

  if (!node) {
    return null;
  }

  const hasChildren = node.children.length > 0;
  const expanded = node.metadata.expanded ?? true;

  const handleToggle = () => {
    const newExpandedState = !expanded;

    if (!newExpandedState) {
      const { selectedNodeId, ancestorRegistry, actions } = store.getState();
      if (checkIsDescendant(nodeId, selectedNodeId, ancestorRegistry)) {
        actions.selectNode(nodeId, node.content.length);
      }
    }

    store.getState().actions.toggleNode(nodeId);
  };

  return (
    <>
      <div
        className={`tree-node-wrapper ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${(depth * 20) + 15}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
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
