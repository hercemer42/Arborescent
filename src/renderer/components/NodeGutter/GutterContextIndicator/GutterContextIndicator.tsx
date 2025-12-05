import { memo, createElement } from 'react';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../../ui/IconPicker/IconPicker';
import { AppliedContext, BundledContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useBundleTooltip } from './hooks/useBundleTooltip';
import { BundleTooltip } from './BundleTooltip';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  isContextDeclaration: boolean;
  contextIcon?: string;
  contextColor?: string;
  bundledContexts: BundledContext[];
  appliedContexts: AppliedContext[];
  activeContext?: AppliedContext;
  onIconClick?: () => void;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextIcon,
  contextColor,
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

  // Regular nodes (including context children): show the active context's icon if they have applied contexts
  if (!isContextDeclaration) {
    if (!activeContext) return null;

    const ActiveIcon = activeContext.icon ? getIconByName(activeContext.icon) : null;
    if (!ActiveIcon) return null;

    return (
      <span
        className="gutter-context-indicator context-applied"
        title={activeContext.name ? `Context: ${activeContext.name}` : 'Has context applied'}
        style={activeContext.color ? { color: activeContext.color } : undefined}
      >
        {createElement(ActiveIcon, { size: 16 })}
      </span>
    );
  }

  // Context declaration nodes: show declaration icon
  // Only show "+" badge when there are bundled or applied contexts
  if (!DeclarationIcon) return null;

  const hasBundledOrApplied = bundledContexts.length > 0 || appliedContexts.length > 0;

  return (
    <button
      ref={hasBundledOrApplied ? bundleRef : undefined}
      className={`gutter-context-indicator ${hasBundledOrApplied ? 'context-bundle' : 'context-declaration'}`}
      onMouseEnter={hasBundledOrApplied ? handleMouseEnter : undefined}
      onMouseLeave={hasBundledOrApplied ? handleMouseLeave : undefined}
      onClick={handleIconClick}
      title="Click to change icon"
      style={contextColor ? { color: contextColor } : undefined}
    >
      <span className="context-bundle-indicator" style={contextColor ? { color: contextColor } : undefined}>
        {createElement(DeclarationIcon, { size: 16 })}
        {hasBundledOrApplied && (
          <span
            className="context-bundle-badge"
            style={contextColor ? { backgroundColor: contextColor } : undefined}
          >+</span>
        )}
      </span>
      {hasBundledOrApplied && showTooltip && (
        <BundleTooltip
          declarationIcon={DeclarationIcon}
          declarationColor={contextColor}
          bundledContexts={bundledContexts}
          appliedContexts={appliedContexts}
          position={tooltipPosition}
        />
      )}
    </button>
  );
});
