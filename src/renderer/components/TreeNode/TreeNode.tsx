import { memo } from 'react';
import type { TreeNode as TreeNodeType } from '../../../shared/types';
import { NodeContent } from '../NodeContent';
import { NodeGutter } from '../NodeGutter/NodeGutter';
import { useStore } from '../../store/tree/useStore';
import { useTerminalStore } from '../../store/terminal/terminalStore';
import { selectActiveSessionNodeId } from '../../store/tree/selectors/activeSessionNodeId';
import { useNodeMouse } from './hooks/useNodeMouse';
import { useNodeEffects } from './hooks/useNodeEffects';
import { useNodeDragDrop } from './hooks/useNodeDragDrop';
import { useNodeToggle } from './hooks/useNodeToggle';
import { useAppliedContext } from './hooks/useAppliedContexts';
import { useNodeVisibleChildren } from '../Tree/hooks/useVisibleChildren';
import { useHiddenSearchMatches } from './hooks/useHiddenSearchMatches';
import { useReviewProposition } from './hooks/useReviewProposition';
import { ReviewControlBar } from './ReviewControlBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import './TreeNode.css';

interface TreeNodeProps {
  nodeId: string;
  depth?: number;
}

function computeFeedbackChangeKindClass(node: TreeNodeType | undefined): string | undefined {
  const baseline = node?.metadata.feedbackBaselineKind;
  if (!baseline) return undefined;

  if (baseline === 'added') return 'feedback-changekind-added';
  if (baseline === 'removed') return 'feedback-changekind-removed';

  const priorContent = node?.metadata.feedbackPriorContent;
  if (priorContent === undefined) {
    return baseline === 'modified' ? 'feedback-changekind-modified' : undefined;
  }

  return node && node.content === priorContent ? undefined : 'feedback-changekind-modified';
}

export const TreeNode = memo(function TreeNode({ nodeId, depth = 0 }: TreeNodeProps) {
  const node = useStore((state) => state.nodes[nodeId]);
  const isSelected = useStore((state) => state.activeNodeId === nodeId);
  const isMultiSelected = useStore((state) => state.multiSelectedNodeIds.has(nodeId));
  const isCollaborating = useStore((state) => state.collaboratingNodeId === nodeId);
  const isCollaboratingDescendant = useStore((state) => {
    const { collaboratingNodeId, ancestorRegistry } = state;
    return collaboratingNodeId !== null && ancestorRegistry[nodeId]?.includes(collaboratingNodeId);
  });
  const isFeedbackFading = useStore((state) => state.feedbackFadingNodeIds.has(nodeId));
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);
  const isActiveSession = useStore(
    (state) => selectActiveSessionNodeId(state, activeTerminalId) === nodeId,
  );
  const isCutNode = node?.metadata.transient?.isCut === true;

  const appliedContext = useAppliedContext(node);

  const expanded = node?.metadata.expanded ?? true;
  const isCollapsed = !expanded;

  // Check for hidden search matches in collapsed descendants
  const hasHiddenSearchMatches = useHiddenSearchMatches(nodeId, isCollapsed);

  const contentLength = node?.content.length ?? 0;

  const visibleChildren = useNodeVisibleChildren(node);
  const hasChildren = visibleChildren.length > 0;

  const reviewPropositionStore = useReviewProposition(nodeId);
  const isUnderReview = reviewPropositionStore !== null;

  const { flashIntensity, isDeleting, nodeRef, onAnimationEnd } = useNodeEffects(nodeId);
  const { isDragging, isOver, dropPosition, setRefs, attributes, listeners } = useNodeDragDrop(nodeId, nodeRef);
  const { handleMouseDown, handleMouseMove, handleClick, wrappedListeners } = useNodeMouse(nodeId, listeners);
  const handleToggle = useNodeToggle(nodeId, expanded, contentLength);

  if (!node) {
    return null;
  }

  // Under review, the whole reviewed subtree is shown from the proposition store: the
  // root renders with its own change-kind highlight (a modified reviewed node shows blue,
  // editable, like any other change) rather than the live node. The gold "under review"
  // affordance moves to the control bar above it.
  if (isUnderReview && reviewPropositionStore) {
    return (
      <>
        <ReviewControlBar />
        <TreeStoreContext.Provider value={reviewPropositionStore}>
          <PropositionRoots depth={depth} />
        </TreeStoreContext.Provider>
      </>
    );
  }

  const feedbackChangeKindClass = computeFeedbackChangeKindClass(node);

  const classNames = [
    'tree-node-wrapper',
    isSelected && 'selected',
    isMultiSelected && 'multi-selected',
    isCollaborating && 'collaborating',
    isCollaboratingDescendant && 'collaborating-descendant',
    isActiveSession && 'active-session',
    isFeedbackFading && 'feedback-fading',
    isCutNode && 'cut-node',
    hasChildren && !expanded && 'collapsed-parent',
    isDragging && 'dragging',
    isOver && dropPosition && `drop-${dropPosition}`,
    flashIntensity && `flashing-${flashIntensity}`,
    isDeleting && 'deleting',
    feedbackChangeKindClass,
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
          appliedContext={appliedContext}
          hasHiddenSearchMatches={hasHiddenSearchMatches}
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

// Rendered inside the proposition store's context, so useStore here reads the feedback
// tree. Renders every proposition root and, through the shared TreeNode recursion, their
// subtrees — each node styled by its own change-kind metadata (added / modified / removed
// placeholders). A single-root review has one root; decomposition has several siblings.
function PropositionRoots({ depth }: { depth: number }) {
  const hiddenRootId = useStore((state) => state.rootNodeId);
  const propositionRootIds = useStore((state) => state.nodes[hiddenRootId]?.children);

  if (!propositionRootIds || propositionRootIds.length === 0) return null;

  return (
    <>
      {propositionRootIds.map((rootId) => (
        <TreeNode key={rootId} nodeId={rootId} depth={depth} />
      ))}
    </>
  );
}
