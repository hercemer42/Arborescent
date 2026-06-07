import { memo, createElement } from 'react';
import { getIconByName } from '../../ui/CustomizeDialog/CustomizeDialog';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';
import { useNodeNavigation } from '../../../hooks/useNodeNavigation';
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
  const { navigateToNode } = useNodeNavigation();

  if (!appliedContext) return null;

  const AppliedIcon = appliedContext.icon ? getIconByName(appliedContext.icon) : null;
  if (!AppliedIcon) return null;

  const declarationId = appliedContext.id;
  const style = appliedContext.color
    ? ({ '--applied-context-color': appliedContext.color } as React.CSSProperties)
    : undefined;

  const body = (
    <>
      <span className="context-applied-indicator">
        {createElement(AppliedIcon, { size: 16 })}
      </span>
      {showTooltip && (
        <AppliedContextTooltip appliedContext={appliedContext} position={tooltipPosition} />
      )}
    </>
  );

  if (declarationId) {
    const navigateToDeclaration = (event: React.MouseEvent) => {
      event.stopPropagation();
      navigateToNode(declarationId);
    };
    return (
      <button
        type="button"
        ref={indicatorRef as React.RefObject<HTMLButtonElement>}
        className="gutter-context-indicator context-applied context-navigable"
        style={style}
        onClick={navigateToDeclaration}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {body}
      </button>
    );
  }

  return (
    <span
      ref={indicatorRef}
      className="gutter-context-indicator context-applied"
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {body}
    </span>
  );
});
