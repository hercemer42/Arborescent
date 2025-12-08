import { memo, createElement } from 'react';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useBundleTooltip } from './hooks/useBundleTooltip';
import { DeclarationContextTooltip } from './DeclarationContextTooltip';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  isContextDeclaration: boolean;
  contextName?: string;
  contextIcon?: string;
  contextColor?: string;
  appliedContext?: AppliedContext;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextName,
  contextIcon,
  contextColor,
  appliedContext,
}: GutterContextIndicatorProps) {
  const {
    bundleRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
  } = useBundleTooltip();
  const DeclarationIcon = getIconByName(contextIcon || DEFAULT_CONTEXT_ICON);

  // Regular nodes: show applied context icon only if explicitly set
  if (!isContextDeclaration) {
    if (!appliedContext) return null;

    const AppliedIcon = appliedContext.icon ? getIconByName(appliedContext.icon) : null;
    if (!AppliedIcon) return null;

    return (
      <span
        className="gutter-context-indicator context-applied"
        style={appliedContext.color ? { color: appliedContext.color } : undefined}
      >
        <span className="context-applied-indicator">
          {createElement(AppliedIcon, { size: 16 })}
        </span>
      </span>
    );
  }

  // Context declaration nodes: show declaration icon with tooltip on hover
  if (!DeclarationIcon) return null;

  const hasApplied = appliedContext !== undefined;
  const declarationContext: AppliedContext = {
    icon: contextIcon || DEFAULT_CONTEXT_ICON,
    color: contextColor,
    name: contextName || 'Context',
  };

  return (
    <span
      ref={bundleRef}
      className={`gutter-context-indicator ${hasApplied ? 'context-bundle' : 'context-declaration'}`}
      style={contextColor ? { color: contextColor } : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="context-bundle-indicator" style={contextColor ? { color: contextColor } : undefined}>
        {createElement(DeclarationIcon, { size: 16 })}
        {hasApplied && (
          <span
            className="context-bundle-badge"
            style={contextColor ? { backgroundColor: contextColor } : undefined}
          >+</span>
        )}
      </span>
      {showTooltip && (
        <DeclarationContextTooltip
          declarationContext={declarationContext}
          appliedContext={appliedContext}
          position={tooltipPosition}
        />
      )}
    </span>
  );
});
