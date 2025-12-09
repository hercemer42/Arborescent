import { memo } from 'react';
import { GutterContextIndicator } from './GutterContextIndicator';
import { AppliedContext } from '../TreeNode/hooks/useAppliedContexts';
import './NodeGutter.css';

interface NodeGutterProps {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  isContextDeclaration?: boolean;
  contextName?: string;
  contextIcon?: string;
  contextColor?: string;
  appliedContext?: AppliedContext;
  hasHiddenSearchMatches?: boolean;
}

export const NodeGutter = memo(function NodeGutter({
  hasChildren,
  expanded,
  onToggle,
  isContextDeclaration = false,
  contextName,
  contextIcon,
  contextColor,
  appliedContext,
  hasHiddenSearchMatches = false,
}: NodeGutterProps) {
  return (
    <div className="node-gutter">
      <GutterContextIndicator
        isContextDeclaration={isContextDeclaration}
        contextName={contextName}
        contextIcon={contextIcon}
        contextColor={contextColor}
        appliedContext={appliedContext}
      />
      {hasChildren && (
        <div className="gutter-expand-toggle">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={[
              'expand-toggle-button',
              expanded ? 'expanded' : 'collapsed',
              hasHiddenSearchMatches && 'has-hidden-matches',
            ].filter(Boolean).join(' ')}
          >
            {expanded ? '⌄' : '›'}
          </button>
        </div>
      )}
    </div>
  );
});
