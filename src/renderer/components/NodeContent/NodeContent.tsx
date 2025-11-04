import { memo, useState, useEffect } from 'react';
import { TreeNode } from '../../../shared/types';
import { ExpandToggle } from '../ui/ExpandToggle';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import { usePluginStore } from '../../store/plugins/pluginStore';
import './NodeContent.css';

interface NodeContentProps {
  node: TreeNode;
  expanded: boolean;
  onToggle: () => void;
}

export const NodeContent = memo(function NodeContent({
  node,
  expanded,
  onToggle,
}: NodeContentProps) {
  const {
    hasChildren,
    isSelected,
    toggleStatus,
    contentRef,
    handleKeyDown,
    handleMouseDown,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  } = useNodeContent(node);

  const enabledPlugins = usePluginStore((state) => state.enabledPlugins);
  const [pluginIndicators, setPluginIndicators] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    async function loadPluginIndicators() {
      const indicators = await Promise.all(
        enabledPlugins.map(async (plugin) => {
          const result = await plugin.extensions.provideNodeIndicator?.(node);
          return result;
        })
      );

      const rendered = indicators
        .filter((indicator) => indicator !== null)
        .map((indicator) => {
          if (indicator && typeof indicator === 'object' && 'type' in indicator && 'value' in indicator) {
            return indicator.value;
          }
          return null;
        });

      setPluginIndicators(rendered);
    }

    loadPluginIndicators();
    // Don't re-fetch indicators when content changes for performance reasons
  }, [node.id, node.metadata.status, node.metadata.plugins, enabledPlugins]);

  return (
    <>
      <div
        className={`node-content ${isSelected ? 'selected' : ''} ${hasChildren && !expanded ? 'collapsed-parent' : ''}`}
        onContextMenu={handleContextMenu}
      >
        {hasChildren && (
          <div className={`expand-toggle-wrapper ${expanded ? 'expanded' : 'collapsed'}`}>
            <ExpandToggle expanded={expanded} onToggle={onToggle} />
          </div>
        )}

        <div className={`status-checkbox-wrapper ${!isSelected ? 'not-selected' : ''}`}>
          <StatusCheckbox
            status={node.metadata.status}
            onToggle={() => toggleStatus(node.id)}
          />
        </div>

        {pluginIndicators.length > 0 && (
          <span className="plugin-indicators">
            {pluginIndicators.map((indicator, i) => (
              <span key={i} className="plugin-indicator">
                {indicator}
              </span>
            ))}
          </span>
        )}

        <div
          ref={contentRef}
          className="node-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMouseDown}
          onInput={handleInput}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
});
