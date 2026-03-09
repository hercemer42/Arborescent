import { memo, createElement } from 'react';
import { getIconByName } from '../../ui/CustomizeDialog/CustomizeDialog';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useAppliedContextTooltip } from './hooks/useAppliedContextTooltip';
import { AppliedContextTooltip } from './AppliedContextTooltip';
import './GutterContextIndicator.css';

interface GutterContextIndicatorProps {
  appliedContext?: AppliedContext;
}

export const GutterContextIndicator = memo(function GutterContextIndicator({
  appliedContext,
}: GutterContextIndicatorProps) {
  const {
    indicatorRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
  } = useAppliedContextTooltip();

  if (!appliedContext) return null;

  const AppliedIcon = appliedContext.icon ? getIconByName(appliedContext.icon) : null;
  if (!AppliedIcon) return null;

  return (
    <span
      ref={indicatorRef}
      className="gutter-context-indicator context-applied"
      style={appliedContext.color ? { '--applied-context-color': appliedContext.color } as React.CSSProperties : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="context-applied-indicator">
        {createElement(AppliedIcon, { size: 16 })}
      </span>
      {showTooltip && (
        <AppliedContextTooltip
          appliedContext={appliedContext}
          position={tooltipPosition}
        />
      )}
    </span>
  );
});
