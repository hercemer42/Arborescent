import { TreeNode } from '../TreeNode';
import { useTreeStore } from '../../store/treeStore';
import { useTreeListeners } from './useTreeListeners';
import './Tree.css';

export function Tree() {
  const rootNodeId = useTreeStore((state) => state.rootNodeId);
  const rootNode = useTreeStore((state) => state.nodes[state.rootNodeId]);

  useTreeListeners();

  if (!rootNodeId || !rootNode) {
    return null;
  }

  return (
    <div className="tree">
      {rootNode.children.map((childId) => (
        <TreeNode key={childId} nodeId={childId} depth={0} />
      ))}
    </div>
  );
}
