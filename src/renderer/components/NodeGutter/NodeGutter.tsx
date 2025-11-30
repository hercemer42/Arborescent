import { memo } from 'react';
import { GutterContextIndicator } from './GutterContextIndicator';
import { AppliedContext } from '../TreeNode/hooks/useAppliedContexts';
import './NodeGutter.css';

interface NodeGutterProps {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  pluginIndicators: React.ReactNode[];
  isContextDeclaration?: boolean;
  contextIcon?: string;
  onIconClick?: () => void;
  appliedContexts?: AppliedContext[];
  activeContext?: AppliedContext;
}

export const NodeGutter = memo(function NodeGutter({
  hasChildren,
  expanded,
  onToggle,
  pluginIndicators,
  isContextDeclaration = false,
  contextIcon,
  onIconClick,
  appliedContexts = [],
  activeContext,
}: NodeGutterProps) {
  return (
    <div className="node-gutter">
      <GutterContextIndicator
        isContextDeclaration={isContextDeclaration}
        contextIcon={contextIcon}
        appliedContexts={appliedContexts}
        activeContext={activeContext}
        onIconClick={onIconClick}
      />
      {pluginIndicators.length > 0 && (
        <span className="gutter-plugin-indicators">
          {pluginIndicators.map((indicator, i) => (
            <span key={i} className="gutter-plugin-indicator">
              {indicator}
            </span>
          ))}
        </span>
      )}
      {hasChildren && (
        <div className="gutter-expand-toggle">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`expand-toggle-button ${expanded ? 'expanded' : 'collapsed'}`}
          >
            {expanded ? '⌄' : '›'}
          </button>
        </div>
      )}
    </div>
  );
});
