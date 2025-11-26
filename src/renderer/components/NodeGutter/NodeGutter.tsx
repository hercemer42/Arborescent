import { memo } from 'react';
import './NodeGutter.css';

interface NodeGutterProps {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  pluginIndicators: React.ReactNode[];
  isContextDeclaration?: boolean;
}

export const NodeGutter = memo(function NodeGutter({
  hasChildren,
  expanded,
  onToggle,
  pluginIndicators,
  isContextDeclaration,
}: NodeGutterProps) {
  return (
    <div className="node-gutter">
      {isContextDeclaration && (
        <span className="gutter-context-indicator" title="Context declaration">
          ◆
        </span>
      )}
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
