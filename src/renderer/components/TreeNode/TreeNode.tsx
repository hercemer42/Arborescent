import { memo } from 'react';
import { NodeContent } from '../NodeContent';
import { NodeGutter } from '../NodeGutter/NodeGutter';
import { useStore } from '../../store/tree/useStore';
import { useNodeMouse } from './hooks/useNodeMouse';
import { useNodeEffects } from './hooks/useNodeEffects';
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import { useNodeToggle } from './hooks/useNodeToggle';
import { useNodeIconClick } from './hooks/useNodeIconClick';
import { useAppliedContexts, useActiveContext, useBundledContexts } from './hooks/useAppliedContexts';
import { usePluginIndicators } from '../NodeGutter/hooks/usePluginIndicators';
import { useNodeVisibleChildren } from '../Tree/hooks/useVisibleChildren';
import './TreeNode.css';

interface TreeNodeProps {
  nodeId: string;
  depth?: number;
}

export const TreeNode = memo(function TreeNode({ nodeId, depth = 0 }: TreeNodeProps) {
  const node = useStore((state) => state.nodes[nodeId]);
  const nodes = useStore((state) => state.nodes);
  const isSelected = useStore((state) => state.activeNodeId === nodeId);
  const isMultiSelected = useStore((state) => state.multiSelectedNodeIds.has(nodeId));
  const collaboratingNodeId = useStore((state) => state.collaboratingNodeId);
  const ancestorRegistry = useStore((state) => state.ancestorRegistry);
  const feedbackFadingNodeIds = useStore((state) => state.feedbackFadingNodeIds);
  const cutNodeIds = useStore((state) => state.cutNodeIds);
  const isCollaborating = collaboratingNodeId === nodeId;
  const isCollaboratingDescendant = collaboratingNodeId !== null && ancestorRegistry[nodeId]?.includes(collaboratingNodeId);
  const isFeedbackFading = feedbackFadingNodeIds.has(nodeId);
  const isCutNode = cutNodeIds.has(nodeId);

  const appliedContexts = useAppliedContexts(node, nodes);
  const bundledContexts = useBundledContexts(node, nodes);
  const activeContext = useActiveContext(node, nodes, ancestorRegistry);

  const expanded = node?.metadata.expanded ?? true;
  const contentLength = node?.content.length ?? 0;

  const visibleChildren = useNodeVisibleChildren(node);
  const hasChildren = visibleChildren.length > 0;

  const { flashIntensity, isDeleting, nodeRef, onAnimationEnd } = useNodeEffects(nodeId);
  const { isDragging, isOver, dropPosition, setRefs, attributes, listeners } = useNodeDragDrop(nodeId, nodeRef);
  const { handleMouseDown, handleMouseMove, handleClick, wrappedListeners } = useNodeMouse(nodeId, listeners);
  const handleToggle = useNodeToggle(nodeId, expanded, contentLength);
  const handleIconClick = useNodeIconClick(nodeId, node);
  const pluginIndicators = usePluginIndicators(node);

  if (!node) {
    return null;
  }

  const classNames = [
    'tree-node-wrapper',
    isSelected && 'selected',
    isMultiSelected && 'multi-selected',
    isCollaborating && 'collaborating',
    isCollaboratingDescendant && 'collaborating-descendant',
    isFeedbackFading && 'feedback-fading',
    isCutNode && 'cut-node',
    hasChildren && !expanded && 'collapsed-parent',
    isDragging && 'dragging',
    isOver && dropPosition && `drop-${dropPosition}`,
    flashIntensity && `flashing-${flashIntensity}`,
    isDeleting && 'deleting',
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
        onAnimationEnd={onAnimationEnd}
      >
        <NodeGutter
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={handleToggle}
          pluginIndicators={pluginIndicators}
          isContextDeclaration={node.metadata.isContextDeclaration === true}
          contextIcon={node.metadata.contextIcon as string | undefined}
          contextColor={node.metadata.contextColor as string | undefined}
          onIconClick={handleIconClick}
          bundledContexts={bundledContexts}
          appliedContexts={appliedContexts}
          activeContext={activeContext}
        />

        <NodeContent
          node={node}
          depth={depth}
        />
      </div>

      {expanded &&
        hasChildren &&
        visibleChildren.map((childId) => (
          <TreeNode
            key={childId}
            nodeId={childId}
            depth={depth + 1}
          />
        ))}
    </>
  );
});
