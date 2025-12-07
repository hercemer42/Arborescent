import { memo, createElement } from 'react';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useBundleTooltip } from './hooks/useBundleTooltip';
import { ActionContextTooltip } from './ActionContextTooltip';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  isContextDeclaration: boolean;
  contextIcon?: string;
  contextColor?: string;
  appliedContexts: AppliedContext[];
  executeContext?: AppliedContext;
  collaborateContext?: AppliedContext;
  onIconClick?: () => void;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextIcon,
  contextColor,
  appliedContexts,
  executeContext,
  collaborateContext,
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

  // Regular nodes: show context icons
  if (!isContextDeclaration) {
    const hasExecuteContext = executeContext !== undefined;
    const hasCollaborateContext = collaborateContext !== undefined;
    const hasBothContexts = hasExecuteContext && hasCollaborateContext;

    // No contexts selected
    if (!hasExecuteContext && !hasCollaborateContext) return null;

    // Show execute context icon (or collaborate if no execute), with + badge when both selected
    const primaryContext = executeContext || collaborateContext;
    const PrimaryIcon = primaryContext?.icon ? getIconByName(primaryContext.icon) : null;
    if (!PrimaryIcon || !primaryContext) return null;

    return (
      <span
        ref={bundleRef}
        className="gutter-context-indicator context-applied"
        style={primaryContext.color ? { color: primaryContext.color } : undefined}
        onMouseEnter={hasBothContexts ? handleMouseEnter : undefined}
        onMouseLeave={hasBothContexts ? handleMouseLeave : undefined}
      >
        <span className="context-applied-indicator">
          {createElement(PrimaryIcon, { size: 16 })}
          {hasBothContexts && collaborateContext && (
            <span
              className="context-applied-badge"
              style={collaborateContext.color ? { backgroundColor: collaborateContext.color } : undefined}
              onMouseEnter={handleMouseEnter}
            >+</span>
          )}
        </span>
        {showTooltip && hasBothContexts && (
          <ActionContextTooltip
            executeContext={executeContext}
            collaborateContext={collaborateContext}
            position={tooltipPosition}
          />
        )}
      </span>
    );
  }

  // Context declaration nodes: show declaration icon (clickable to change)
  if (!DeclarationIcon) return null;

  const hasApplied = appliedContexts.length > 0;

  return (
    <button
      className={`gutter-context-indicator ${hasApplied ? 'context-bundle' : 'context-declaration'}`}
      onClick={handleIconClick}
      title="Click to change icon"
      style={contextColor ? { color: contextColor } : undefined}
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
    </button>
  );
});
