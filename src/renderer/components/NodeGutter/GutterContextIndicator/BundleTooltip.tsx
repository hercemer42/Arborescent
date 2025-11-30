import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { getIconByName } from '../../ui/IconPicker/IconPicker';
import { BundledContext } from '../../TreeNode/hooks/useAppliedContexts';

interface BundleTooltipProps {
  declarationIconDef: IconDefinition | null;
  bundledContexts: BundledContext[];
  position: { top: number; left: number };
}

export function BundleTooltip({ declarationIconDef, bundledContexts, position }: BundleTooltipProps) {
  return createPortal(
    <div
      className="context-bundle-tooltip"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
      }}
    >
      <div className="context-bundle-tooltip-title">Declared context:</div>
      <div className="context-bundle-tooltip-item">
        {declarationIconDef && <FontAwesomeIcon icon={declarationIconDef} className="tooltip-icon" />}
        <span className="tooltip-name">This node</span>
      </div>
      <div className="context-bundle-tooltip-title" style={{ marginTop: '8px' }}>Bundled declarations:</div>
      {bundledContexts.map((ctx, index) => {
        const iconDef = ctx.icon ? getIconByName(ctx.icon) : null;
        return (
          <div key={index} className="context-bundle-tooltip-item">
            {iconDef && <FontAwesomeIcon icon={iconDef} className="tooltip-icon" />}
            <span className="tooltip-name">{ctx.name || 'Context'}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
