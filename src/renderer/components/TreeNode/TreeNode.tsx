import { memo } from 'react';
import { NodeContent } from '../NodeContent';
import { NodeGutter } from '../NodeGutter/NodeGutter';
import { useStore } from '../../store/tree/useStore';
import { useNodeMouse } from './hooks/useNodeMouse';
import { useNodeEffects } from './hooks/useNodeEffects';
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import { useNodeToggle } from './hooks/useNodeToggle';
import { usePluginIndicators } from '../NodeGutter/hooks/usePluginIndicators';
import './TreeNode.css';

interface TreeNodeProps {
  nodeId: string;
  depth?: number;
}

export const TreeNode = memo(function TreeNode({ nodeId, depth = 0 }: TreeNodeProps) {
  const node = useStore((state) => state.nodes[nodeId]);
  const isSelected = useStore((state) => state.activeNodeId === nodeId);
  const isMultiSelected = useStore((state) => state.multiSelectedNodeIds.has(nodeId));
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const reviewFadingNodeIds = useStore((state) => state.reviewFadingNodeIds);
  const isReviewing = reviewingNodeId === nodeId;
  const isReviewingDescendant = reviewingNodeId !== null && ancestorRegistry[nodeId]?.includes(reviewingNodeId);
  const isReviewFading = reviewFadingNodeIds.has(nodeId);

  const hasChildren = node ? node.children.length > 0 : false;
  const expanded = node?.metadata.expanded ?? true;
  const contentLength = node?.content.length ?? 0;

  const { flashIntensity, nodeRef } = useNodeEffects(nodeId);
  const { isDragging, isOver, dropPosition, setRefs, attributes, listeners } = useNodeDragDrop(nodeId, nodeRef);
  const { handleMouseDown, handleMouseMove, handleClick, wrappedListeners } = useNodeMouse(nodeId, listeners);
  const handleToggle = useNodeToggle(nodeId, expanded, contentLength);
  const pluginIndicators = usePluginIndicators(node);

  if (!node) {
    return null;
  }

  const classNames = [
    'tree-node-wrapper',
    isSelected && 'selected',
    isMultiSelected && 'multi-selected',
    isReviewing && 'reviewing',
    isReviewingDescendant && 'reviewing-descendant',
    isReviewFading && 'review-fading',
    hasChildren && !expanded && 'collapsed-parent',
    isDragging && 'dragging',
    isOver && dropPosition && `drop-${dropPosition}`,
    flashIntensity && `flashing-${flashIntensity}`,
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        ref={setRefs}
        className={classNames}
        data-node-id={nodeId}
        {...attributes}
        {...wrappedListeners}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        <NodeGutter
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={handleToggle}
          pluginIndicators={pluginIndicators}
        />

        <NodeContent
          node={node}
          depth={depth}
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
