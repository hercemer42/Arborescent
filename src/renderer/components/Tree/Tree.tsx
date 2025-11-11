import { memo } from 'react';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { TreeNode } from '../TreeNode';
import { useStore } from '../../store/tree/useStore';
import { useTree } from './hooks/useTree';
import { useTreeDragDrop } from './hooks/useTreeDragDrop';
import { useTreeClick } from './hooks/useTreeClick';
import './Tree.css';

export const Tree = memo(function Tree() {
  const rootNodeId = useStore((state) => state.rootNodeId);
  const rootNodeChildren = useStore((state) =>
    state.nodes[state.rootNodeId]?.children
  );

  useTree();
  const { sensors, activeId, draggedNodeIds, draggedNodeDepth, dropAnimation, handleDragStart, handleDragEnd } = useTreeDragDrop();
  const { handleTreeClick } = useTreeClick();

  if (!rootNodeId || !rootNodeChildren) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="tree" onClick={handleTreeClick}>
        {rootNodeChildren.map((childId) => (
          <TreeNode key={childId} nodeId={childId} depth={0} />
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
          <div>
            {draggedNodeIds.map((nodeId) => (
              <TreeNode key={nodeId} nodeId={nodeId} depth={draggedNodeDepth} />
            ))}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
