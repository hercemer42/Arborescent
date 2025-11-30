import { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../../ui/IconPicker/IconPicker';
import { AppliedContext, BundledContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useBundleTooltip } from './hooks/useBundleTooltip';
import { BundleTooltip } from './BundleTooltip';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  isContextDeclaration: boolean;
  contextIcon?: string;
  bundledContexts: BundledContext[];
  activeContext?: AppliedContext;
  onIconClick?: () => void;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextIcon,
  bundledContexts,
  activeContext,
  onIconClick,
}: GutterContextIndicatorProps) {
  const {
    bundleRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
    handleIconClick,
  } = useBundleTooltip(onIconClick);
  const declarationIconDef = getIconByName(contextIcon || DEFAULT_CONTEXT_ICON);

  // Context declaration nodes: show declaration icon or bundle indicator
  if (isContextDeclaration) {
    // No bundled contexts: show declaration's own icon (clickable)
    if (bundledContexts.length === 0) {
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

    // 1+ bundled contexts: show cog with count badge and tooltip (not clickable)
    return (
      <div
        ref={bundleRef}
        className="gutter-context-indicator context-bundle"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="context-bundle-indicator">
          <FontAwesomeIcon icon={faGear} />
          <span className="context-bundle-count">{bundledContexts.length}</span>
        </span>
        {showTooltip && (
          <BundleTooltip
            declarationIconDef={declarationIconDef}
            bundledContexts={bundledContexts}
            position={tooltipPosition}
          />
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
