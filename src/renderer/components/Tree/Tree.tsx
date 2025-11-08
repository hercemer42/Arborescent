import { memo } from 'react';
import { DndContext } from '@dnd-kit/core';
import { TreeNode } from '../TreeNode';
import { useStore } from '../../store/tree/useStore';
import { useTree } from './hooks/useTree';
import { useTreeDragDrop } from './hooks/useTreeDragDrop';
import './Tree.css';

export const Tree = memo(function Tree() {
  const rootNodeId = useStore((state) => state.rootNodeId);
  const rootNodeChildren = useStore((state) =>
    state.nodes[state.rootNodeId]?.children
  );

  useTree();
  const { sensors, handleDragEnd } = useTreeDragDrop();

  if (!rootNodeId || !rootNodeChildren) {
    return null;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="tree">
        {rootNodeChildren.map((childId) => (
          <TreeNode key={childId} nodeId={childId} depth={0} />
        ))}
      </div>
    </DndContext>
  );
});
