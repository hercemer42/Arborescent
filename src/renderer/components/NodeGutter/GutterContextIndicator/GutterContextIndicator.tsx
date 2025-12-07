import { memo, createElement } from 'react';
import { getIconByName, DEFAULT_CONTEXT_ICON } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useBundleTooltip } from './hooks/useBundleTooltip';
import { ActionContextTooltip } from './ActionContextTooltip';
import { DeclarationContextTooltip } from './DeclarationContextTooltip';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  isContextDeclaration: boolean;
  contextName?: string;
  contextIcon?: string;
  contextColor?: string;
  appliedContexts: AppliedContext[];
  executeContext?: AppliedContext;
  collaborateContext?: AppliedContext;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  isContextDeclaration,
  contextName,
  contextIcon,
  contextColor,
  appliedContexts,
  executeContext,
  collaborateContext,
}: GutterContextIndicatorProps) {
  const {
    bundleRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
  } = useBundleTooltip();
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

  // Context declaration nodes: show declaration icon with tooltip on hover
  if (!DeclarationIcon) return null;

  const hasApplied = appliedContexts.length > 0 || executeContext !== undefined || collaborateContext !== undefined;
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
          executeContext={executeContext}
          collaborateContext={collaborateContext}
          position={tooltipPosition}
        />
      )}
    </span>
  );
});
