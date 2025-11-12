import { memo } from 'react';
import './NodeGutter.css';

interface NodeGutterProps {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  pluginIndicators: React.ReactNode[];
}

export const NodeGutter = memo(function NodeGutter({
  hasChildren,
  expanded,
  onToggle,
  pluginIndicators,
}: NodeGutterProps) {
  return (
    <div className="node-gutter">
      {/* Future: context icons will go here */}
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
