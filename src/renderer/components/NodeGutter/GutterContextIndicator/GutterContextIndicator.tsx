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
  appliedContexts: AppliedContext[];
  activeContext?: AppliedContext;
  onIconClick?: () => void;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextIcon,
  bundledContexts,
  appliedContexts,
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
    const hasBundledOrApplied = bundledContexts.length > 0 || appliedContexts.length > 0;

    // No bundled or applied contexts: show declaration's own icon (clickable)
    if (!hasBundledOrApplied) {
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

    // 1+ bundled or applied contexts: show cog with count badge and tooltip (not clickable)
    // Count = self (1) + bundled + applied
    const totalCount = 1 + bundledContexts.length + appliedContexts.length;
    return (
      <div
        ref={bundleRef}
        className="gutter-context-indicator context-bundle"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="context-bundle-indicator">
          <FontAwesomeIcon icon={faGear} />
          <span className="context-bundle-count">{totalCount}</span>
        </span>
        {showTooltip && (
          <BundleTooltip
            declarationIconDef={declarationIconDef}
            bundledContexts={bundledContexts}
            appliedContexts={appliedContexts}
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
