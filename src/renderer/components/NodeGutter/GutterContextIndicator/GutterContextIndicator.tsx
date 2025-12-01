import { memo, createElement } from 'react';
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
  const DeclarationIcon = getIconByName(contextIcon || DEFAULT_CONTEXT_ICON);

  // Context declaration nodes: show declaration icon or bundle indicator
  if (isContextDeclaration) {
    const hasBundledOrApplied = bundledContexts.length > 0 || appliedContexts.length > 0;

    // No bundled or applied contexts: show declaration's own icon (clickable)
    if (!hasBundledOrApplied) {
      if (!DeclarationIcon) return null;
      return (
        <button
          className="gutter-context-indicator context-declaration"
          title="Click to change icon"
          onClick={handleIconClick}
        >
          {createElement(DeclarationIcon, { size: 16 })}
        </button>
      );
    }

    // 1+ bundled or applied contexts: show declaration icon with "+" badge and tooltip
    // Clickable to change the declaration icon
    if (!DeclarationIcon) return null;
    return (
      <button
        ref={bundleRef}
        className="gutter-context-indicator context-bundle"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleIconClick}
        title="Click to change icon"
      >
        <span className="context-bundle-indicator">
          {createElement(DeclarationIcon, { size: 16 })}
          <span className="context-bundle-badge">+</span>
        </span>
        {showTooltip && (
          <BundleTooltip
            declarationIcon={DeclarationIcon}
            bundledContexts={bundledContexts}
            appliedContexts={appliedContexts}
            position={tooltipPosition}
          />
        )}
      </button>
    );
  }

  // Regular nodes: show only the active context's icon
  if (!activeContext) return null;

  const ActiveIcon = activeContext.icon ? getIconByName(activeContext.icon) : null;
  if (!ActiveIcon) return null;

  return (
    <span
      className="gutter-context-indicator context-applied"
      title={activeContext.name ? `Context: ${activeContext.name}` : 'Has context applied'}
    >
      {createElement(ActiveIcon, { size: 16 })}
    </span>
  );
});
