import { memo, useRef, useSyncExternalStore } from 'react';
import { DndContext, DragOverlay, pointerWithin, Modifier } from '@dnd-kit/core';
import { TreeNode } from '../TreeNode';
import { useStore } from '../../store/tree/useStore';
import { feedbackTreeStore } from '../../store/feedback/feedbackTreeStore';
import { useTree } from './hooks/useTree';
import { useTreeDragDrop } from './hooks/useTreeDragDrop';
import { useTreeClick } from './hooks/useTreeClick';
import { useVisibleChildren } from './hooks/useVisibleChildren';
import { useScrollAnchor } from './hooks/useScrollAnchor';
import './Tree.css';

// Offset the drag ghost up by 6px so it doesn't obscure the drop indicator line
const ghostOffsetModifier: Modifier = ({ transform }) => ({
  ...transform,
  y: transform.y - 6,
});

interface TreeProps {
  zoomedNodeId?: string;
}

export const Tree = memo(function Tree({ zoomedNodeId }: TreeProps) {
  const rootNodeId = useStore((state) => state.rootNodeId);
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);

  const displayRootId = zoomedNodeId || rootNodeId;

  // Only subscribe to the specific node's children, not the entire nodes object
  const displayChildren = useStore((state) => state.nodes[displayRootId]?.children);

  useTree();
  const { sensors, activeId, draggedNodeIds, draggedNodeDepth, dropAnimation, handleDragStart, handleDragEnd } = useTreeDragDrop();
  const { handleTreeClick } = useTreeClick();
  const visibleChildren = useVisibleChildren(displayChildren);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const feedbackRevision = useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    feedbackTreeStore.getVersion.bind(feedbackTreeStore),
    () => 0,
  );
  useScrollAnchor(scrollContainerRef, feedbackRevision);

  if (!displayRootId || !displayChildren) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={scrollContainerRef} className={`tree ${blueprintModeEnabled ? 'blueprint-mode' : ''}`} onClick={handleTreeClick}>
        {visibleChildren.map((childId) => (
          <TreeNode key={childId} nodeId={childId} depth={0} />
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation} modifiers={[ghostOffsetModifier]}>
        {activeId ? (
          <div className="drag-ghost">
            {draggedNodeIds.map((nodeId) => (
              <TreeNode key={nodeId} nodeId={nodeId} depth={draggedNodeDepth} />
            ))}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
