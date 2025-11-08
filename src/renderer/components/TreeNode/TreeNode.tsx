import { memo, useCallback } from 'react';
import { NodeContent } from '../NodeContent';
import { useStore } from '../../store/tree/useStore';
import { useActiveTreeStore } from '../../store/tree/TreeStoreContext';
import { isDescendant as checkIsDescendant } from '../../utils/ancestry';
import { useNodeMouse } from './hooks/useNodeMouse';
import { useNodeEffects } from './hooks/useNodeEffects';
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import './TreeNode.css';

interface TreeNodeProps {
  nodeId: string;
  depth?: number;
}

export const TreeNode = memo(function TreeNode({ nodeId, depth = 0 }: TreeNodeProps) {
  const node = useStore((state) => state.nodes[nodeId]);
  const isSelected = useStore((state) => state.selectedNodeId === nodeId);
  const isMultiSelected = useStore((state) => state.selectedNodeIds.has(nodeId));
  const { handleMouseDown, handleMouseMove, handleClick } = useNodeMouse(nodeId);
  const store = useActiveTreeStore();

  const hasChildren = node ? node.children.length > 0 : false;
  const expanded = node?.metadata.expanded ?? true;
  const contentLength = node?.content.length ?? 0;

  const { flashIntensity, nodeRef } = useNodeEffects(nodeId);
  const { isDragging, isOver, dropPosition, setRefs, attributes, listeners } = useNodeDragDrop(nodeId, nodeRef);

  const handleToggle = useCallback(() => {
    const newExpandedState = !expanded;

    if (!newExpandedState) {
      const { selectedNodeId, ancestorRegistry, actions } = store.getState();
      if (checkIsDescendant(nodeId, selectedNodeId, ancestorRegistry)) {
        actions.selectNode(nodeId, contentLength);
      }
    }

    store.getState().actions.toggleNode(nodeId);
  }, [expanded, nodeId, contentLength, store]);

  if (!node) {
    return null;
  }

  const classNames = [
    'tree-node-wrapper',
    isSelected && 'selected',
    isMultiSelected && 'multi-selected',
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
        style={{ paddingLeft: `${(depth * 20) + 15}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        {...attributes}
        {...listeners}
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
