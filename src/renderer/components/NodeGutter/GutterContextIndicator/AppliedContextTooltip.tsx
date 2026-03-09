import { createPortal } from 'react-dom';
import { createElement } from 'react';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';

interface AppliedContextTooltipProps {
  appliedContext: AppliedContext;
  position: { top: number; left: number };
}

export function AppliedContextTooltip({
  appliedContext,
  position,
}: AppliedContextTooltipProps) {
  return createPortal(
    <div
      className="applied-context-tooltip"
      style={{
        '--tooltip-top': `${position.top}px`,
        '--tooltip-left': `${position.left}px`,
        '--context-color': appliedContext.color || 'inherit',
      } as React.CSSProperties}
    >
      <div className="applied-context-tooltip-title">Applied context:</div>
      <div className="applied-context-tooltip-item">
        <span className="tooltip-icon-wrapper">
          {appliedContext.icon && createElement(getIconByName(appliedContext.icon)!, { size: 12, className: 'tooltip-icon' })}
        </span>
        <span className="tooltip-name">{appliedContext.name || 'Context'}</span>
      </div>
    </div>,
    document.body
  );
}
