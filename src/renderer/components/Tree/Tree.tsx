import { TreeNode } from '../TreeNode';
import { useStore } from '../../store/tree/useStore';
import { useTreeListeners } from './useTreeListeners';
import './Tree.css';

export function Tree() {
  const rootNodeId = useStore((state) => state.rootNodeId);
  const rootNode = useStore((state) => state.nodes[state.rootNodeId]);

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
