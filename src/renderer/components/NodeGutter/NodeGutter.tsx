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
  contextName?: string;
  contextIcon?: string;
  contextColor?: string;
  appliedContexts?: AppliedContext[];
  executeContext?: AppliedContext;
  collaborateContext?: AppliedContext;
}

export const NodeGutter = memo(function NodeGutter({
  hasChildren,
  expanded,
  onToggle,
  pluginIndicators,
  isContextDeclaration = false,
  contextName,
  contextIcon,
  contextColor,
  appliedContexts = [],
  executeContext,
  collaborateContext,
}: NodeGutterProps) {
  return (
    <div className="node-gutter">
      <GutterContextIndicator
        isContextDeclaration={isContextDeclaration}
        contextName={contextName}
        contextIcon={contextIcon}
        contextColor={contextColor}
        appliedContexts={appliedContexts}
        executeContext={executeContext}
        collaborateContext={collaborateContext}
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
