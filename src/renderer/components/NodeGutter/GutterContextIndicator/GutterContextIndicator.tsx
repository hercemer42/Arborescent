import { memo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  isContextDeclaration: boolean;
  contextIcon?: string;
  appliedContexts: AppliedContext[];
  activeContext?: AppliedContext;
  onIconClick?: () => void;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextIcon,
  appliedContexts,
  activeContext,
  onIconClick,
}: GutterContextIndicatorProps) {
  const [showBundleTooltip, setShowBundleTooltip] = useState(false);
  const declarationIconDef = getIconByName(contextIcon || DEFAULT_CONTEXT_ICON);

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIconClick?.();
  };

  // Context declaration nodes: show bundle indicator based on applied context count
  if (isContextDeclaration) {
    // No applied contexts: show declaration icon
    if (appliedContexts.length === 0) {
      if (!declarationIconDef) return null;
      return (
        <button
          className="gutter-context-indicator context-declaration"
          title="Click to change icon"
          onClick={handleIconClick}
        >
          <FontAwesomeIcon icon={declarationIconDef} />
        </button>
      );
    }

    // Single applied context: show that context's icon
    if (appliedContexts.length === 1) {
      const singleContext = appliedContexts[0];
      const iconDef = singleContext.icon ? getIconByName(singleContext.icon) : declarationIconDef;
      if (!iconDef) return null;
      return (
        <button
          className="gutter-context-indicator context-declaration has-bundle"
          title={`Bundle: ${singleContext.name || 'Context'} (click to change icon)`}
          onClick={handleIconClick}
        >
          <FontAwesomeIcon icon={iconDef} />
        </button>
      );
    }

    // Multiple applied contexts: show cog with count badge and tooltip
    return (
      <div
        className="gutter-context-indicator context-bundle"
        onMouseEnter={() => setShowBundleTooltip(true)}
        onMouseLeave={() => setShowBundleTooltip(false)}
      >
        <button
          className="context-bundle-button"
          title="Click to change icon"
          onClick={handleIconClick}
        >
          <FontAwesomeIcon icon={faCog} />
          <span className="context-bundle-count">{appliedContexts.length}</span>
        </button>
        {showBundleTooltip && (
          <div className="context-bundle-tooltip">
            <div className="context-bundle-tooltip-title">Bundled contexts:</div>
            {appliedContexts.map((ctx, index) => {
              const iconDef = ctx.icon ? getIconByName(ctx.icon) : null;
              return (
                <div key={index} className="context-bundle-tooltip-item">
                  {iconDef && <FontAwesomeIcon icon={iconDef} className="tooltip-icon" />}
                  <span className="tooltip-name">{ctx.name || 'Context'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Regular nodes: show only the active context's icon
  if (!activeContext) return null;

  const iconDef = activeContext.icon ? getIconByName(activeContext.icon) : null;
  if (!iconDef) return null;

  return (
    <span
      className="gutter-context-indicator context-applied"
      title={activeContext.name ? `Context: ${activeContext.name}` : 'Has context applied'}
    >
      <FontAwesomeIcon icon={iconDef} />
    </span>
  );
});
