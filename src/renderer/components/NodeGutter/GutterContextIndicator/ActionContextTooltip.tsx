import { createPortal } from 'react-dom';
import { createElement } from 'react';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { AppliedContext } from '../../TreeNode/hooks/useAppliedContexts';

interface ActionContextTooltipProps {
  executeContext?: AppliedContext;
  collaborateContext?: AppliedContext;
  position: { top: number; left: number };
}

export function ActionContextTooltip({ executeContext, collaborateContext, position }: ActionContextTooltipProps) {
  return createPortal(
    <div
      className="context-bundle-tooltip"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
      }}
    >
      {executeContext && (
        <>
          <div className="context-bundle-tooltip-title">Execute:</div>
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
          <div className="context-bundle-tooltip-title" style={executeContext ? { marginTop: '8px' } : undefined}>Collaborate:</div>
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
