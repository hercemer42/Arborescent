import { createPortal } from 'react-dom';
import { createElement } from 'react';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';

interface DeclarationContextTooltipProps {
  declarationContext: AppliedContext;
  executeContext?: AppliedContext;
  collaborateContext?: AppliedContext;
  position: { top: number; left: number };
}

export function DeclarationContextTooltip({
  declarationContext,
  executeContext,
  collaborateContext,
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
      {executeContext && (
        <>
          <div className="context-bundle-tooltip-title" style={{ marginTop: '8px' }}>Execute:</div>
          <div className="context-bundle-tooltip-item">
            <span style={executeContext.color ? { color: executeContext.color } : undefined}>
              {executeContext.icon && createElement(getIconByName(executeContext.icon)!, { size: 12, className: 'tooltip-icon' })}
            </span>
            <span className="tooltip-name">{executeContext.name || 'Context'}</span>
          </div>
        </>
      )}
      {collaborateContext && (
        <>
          <div className="context-bundle-tooltip-title" style={{ marginTop: '8px' }}>Collaborate:</div>
          <div className="context-bundle-tooltip-item">
            <span style={collaborateContext.color ? { color: collaborateContext.color } : undefined}>
              {collaborateContext.icon && createElement(getIconByName(collaborateContext.icon)!, { size: 12, className: 'tooltip-icon' })}
            </span>
            <span className="tooltip-name">{collaborateContext.name || 'Context'}</span>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
