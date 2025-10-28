import { memo } from 'react';
import { TreeNode } from '../TreeNode';
import { useStore } from '../../store/tree/useStore';
import { useTree } from './hooks/useTree';
import './Tree.css';

export const Tree = memo(function Tree() {
  const rootNodeId = useStore((state) => state.rootNodeId);
  const rootNodeChildren = useStore((state) =>
    state.nodes[state.rootNodeId]?.children
  );

  useTree();

  if (!rootNodeId || !rootNodeChildren) {
    return null;
  }

  return (
    <div className="tree">
      {rootNodeChildren.map((childId) => (
        <TreeNode key={childId} nodeId={childId} depth={0} />
      ))}
    </div>
  );
});
