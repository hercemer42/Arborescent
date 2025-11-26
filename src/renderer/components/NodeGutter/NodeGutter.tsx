import { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../ui/IconPicker/IconPicker';
import './NodeGutter.css';

interface NodeGutterProps {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  pluginIndicators: React.ReactNode[];
  isContextDeclaration?: boolean;
  contextIcon?: string;
  onIconClick?: () => void;
  appliedContextIcon?: string;
  appliedContextName?: string;
}

export const NodeGutter = memo(function NodeGutter({
  hasChildren,
  expanded,
  onToggle,
  pluginIndicators,
  isContextDeclaration,
  contextIcon,
  onIconClick,
  appliedContextIcon,
  appliedContextName,
}: NodeGutterProps) {
  const declarationIconDef = getIconByName(contextIcon || DEFAULT_CONTEXT_ICON);
  const appliedIconDef = appliedContextIcon ? getIconByName(appliedContextIcon) : null;

  return (
    <div className="node-gutter">
      {/* Show context declaration icon (clickable to change) */}
      {isContextDeclaration && declarationIconDef && (
        <button
          className="gutter-context-indicator context-declaration"
          title="Click to change icon"
          onClick={(e) => {
            e.stopPropagation();
            onIconClick?.();
          }}
        >
          <FontAwesomeIcon icon={declarationIconDef} />
        </button>
      )}
      {/* Show applied context icon (not clickable, visual indicator only) */}
      {!isContextDeclaration && appliedIconDef && (
        <span
          className="gutter-context-indicator context-applied"
          title={appliedContextName ? `Context: ${appliedContextName}` : 'Has context applied'}
        >
          <FontAwesomeIcon icon={appliedIconDef} />
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
