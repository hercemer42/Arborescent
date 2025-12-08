import { createPortal } from 'react-dom';
import { createElement } from 'react';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';

interface DeclarationContextTooltipProps {
  declarationContext: AppliedContext;
  appliedContext?: AppliedContext;
  position: { top: number; left: number };
}

export function DeclarationContextTooltip({
  declarationContext,
  appliedContext,
  position,
}: DeclarationContextTooltipProps) {
  return createPortal(
    <div
      className="context-bundle-tooltip"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
      }}
    >
      <div className="context-bundle-tooltip-title">Declared:</div>
      <div className="context-bundle-tooltip-item">
        <span style={declarationContext.color ? { color: declarationContext.color } : undefined}>
          {declarationContext.icon && createElement(getIconByName(declarationContext.icon)!, { size: 12, className: 'tooltip-icon' })}
        </span>
        <span className="tooltip-name">{declarationContext.name}</span>
      </div>
      {appliedContext && (
        <>
          <div className="context-bundle-tooltip-title" style={{ marginTop: '8px' }}>Applied:</div>
          <div className="context-bundle-tooltip-item">
            <span style={appliedContext.color ? { color: appliedContext.color } : undefined}>
              {appliedContext.icon && createElement(getIconByName(appliedContext.icon)!, { size: 12, className: 'tooltip-icon' })}
            </span>
            <span className="tooltip-name">{appliedContext.name || 'Context'}</span>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
