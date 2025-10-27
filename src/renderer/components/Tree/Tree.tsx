import { TreeNode } from '../TreeNode';
import { useStore } from '../../store/tree/useStore';
import { useTree } from './hooks/useTree';
import { getVisibleChildren } from '../../utils/nodeHelpers';
import './Tree.css';

export function Tree() {
  const rootNodeId = useStore((state) => state.rootNodeId);
  const rootNode = useStore((state) => state.nodes[state.rootNodeId]);
  const nodes = useStore((state) => state.nodes);

  useTree();

  if (!rootNodeId || !rootNode) {
    return null;
  }

  const visibleChildren = getVisibleChildren(rootNode.children, nodes);

  return (
    <div className="tree">
      {visibleChildren.map((childId) => (
        <TreeNode key={childId} nodeId={childId} depth={0} />
      ))}
    </div>
  );
}
