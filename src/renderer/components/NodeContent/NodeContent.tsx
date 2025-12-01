import { memo, createElement, useCallback } from 'react';
import { Boxes } from 'lucide-react';
import { TreeNode } from '../../../shared/types';
import { StatusCheckbox } from '../ui/StatusCheckbox';
import { ContextMenu } from '../ui/ContextMenu';
import { useNodeContent } from './hooks/useNodeContent';
import { useStore } from '../../store/tree/useStore';
import { useIconPickerStore } from '../../store/iconPicker/iconPickerStore';
import { getIconByName } from '../ui/IconPicker/IconPicker';
import { DEFAULT_BLUEPRINT_ICON } from '../../store/tree/actions/blueprintActions';
import './NodeContent.css';

interface NodeContentProps {
  node: TreeNode;
  depth: number;
}

function NodeContentComponent({
  node,
  depth,
}: NodeContentProps) {
  const {
    isSelected,
    toggleStatus,
    contentRef,
    handleInput,
    handleContextMenu,
    contextMenu,
    contextMenuItems,
    closeContextMenu,
  } = useNodeContent(node);

  const setBlueprintIcon = useStore((state) => state.actions.setBlueprintIcon);
  const openIconPicker = useIconPickerStore((state) => state.open);

  const handleBlueprintIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIcon = (node.metadata.blueprintIcon as string) || DEFAULT_BLUEPRINT_ICON;
    openIconPicker(currentIcon, (iconName) => {
      setBlueprintIcon(node.id, iconName);
    });
  }, [node.id, node.metadata.blueprintIcon, openIconPicker, setBlueprintIcon]);

  const blueprintIconName = (node.metadata.blueprintIcon as string) || DEFAULT_BLUEPRINT_ICON;
  const BlueprintIcon = getIconByName(blueprintIconName) || Boxes;

  return (
    <>
      <div
        className={`node-content ${isSelected ? 'selected' : ''}`}
        onContextMenu={handleContextMenu}
        style={{
          paddingLeft: `${(depth * 20) + 15}px`,
          '--indent-width': `${depth * 20}px`,
        } as React.CSSProperties}
      >
        <div className={`status-checkbox-wrapper ${!isSelected ? 'not-selected' : ''}`}>
          {node.metadata.isBlueprint ? (
            <button
              className="blueprint-indicator"
              title="Click to change icon"
              onClick={handleBlueprintIconClick}
            >
              {createElement(BlueprintIcon, { size: 19 })}
            </button>
          ) : (
            <StatusCheckbox
              status={node.metadata.status}
              onToggle={() => toggleStatus(node.id)}
            />
          )}
        </div>

        <div
          ref={contentRef}
          className="node-text"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
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
}

export const NodeContent = memo(NodeContentComponent);
