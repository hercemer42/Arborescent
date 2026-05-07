import { createElement, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { TriangleAlert } from 'lucide-react';
import { useIconPickerBehavior } from './hooks/useIconPickerBehavior';
import { useIconPickerColors } from './hooks/useIconPickerColors';
import { IconSelection } from '../../../store/customizeDialog/customizeDialogStore';
import { Modal } from '../Modal';
import { IconGrid } from './IconGrid';
import { ColorPicker } from './ColorPicker';
import { ContextFlagsCheckboxes } from './ContextFlagsCheckboxes';
import type { LucideIcon } from './types';
import './CustomizeDialog.css';

// Re-export the shared type/constant so existing call sites keep working.
export type { LucideIcon } from './types';
export { PRESET_COLORS } from './types';

// Curated list of common/useful icons for context marking
// Using Lucide icon names (PascalCase component names)
const CURATED_ICON_NAMES = [
  // Ideas & Knowledge
  'Lightbulb', 'Brain', 'GraduationCap', 'Book', 'Bookmark',
  // Status & Priority
  'Star', 'Flag', 'Bell', 'CircleAlert', 'TriangleAlert',
  // Actions & Tasks
  'Check', 'CircleCheck', 'ListChecks', 'Clipboard', 'Pin',
  // Objects
  'Key', 'Lock', 'Unlock', 'Settings', 'Wrench',
  // Communication
  'MessageCircle', 'MessageSquare', 'Mail', 'Megaphone', 'Quote',
  // Files & Data
  'File', 'Folder', 'Database', 'Code', 'Terminal',
  // People & Users
  'User', 'Users', 'UserCog', 'BookUser', 'IdCard',
  // Symbols
  'Heart', 'Zap', 'Flame', 'Gem', 'Crown',
  // Navigation & Location
  'MapPin', 'Compass', 'Map', 'Route', 'Signpost',
  // Misc
  'Tag', 'Tags', 'Puzzle', 'Link', 'Paperclip',
];

// Get all available Lucide icons
function getAllLucideIcons(): { Icon: LucideIcon; name: string }[] {
  return Object.entries(LucideIcons)
    .filter(([name, component]) => {
      // Filter to only icon components (exclude utilities, types, etc.)
      // Lucide icons are forwardRef objects with $$typeof Symbol(react.forward_ref)
      const isReactComponent = component !== null &&
        typeof component === 'object' &&
        '$$typeof' in component;
      return (
        isReactComponent &&
        name !== 'default' &&
        !name.startsWith('Lucide') &&
        !name.endsWith('Icon') && // Exclude duplicate *Icon variants
        /^[A-Z]/.test(name) // Must start with capital letter
      );
    })
    .map(([name, Icon]) => ({
      Icon: Icon as LucideIcon,
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Get curated icons in the order defined above
function getCuratedIcons(): { Icon: LucideIcon; name: string }[] {
  const allIcons = getAllLucideIcons();
  const iconMap = new Map(allIcons.map(i => [i.name, i]));

  return CURATED_ICON_NAMES
    .map(name => iconMap.get(name))
    .filter((i): i is { Icon: LucideIcon; name: string } => i !== undefined);
}

const ALL_ICONS = getAllLucideIcons();
const CURATED_ICONS = getCuratedIcons();

// Map for O(1) icon lookup by name
const ICON_MAP = new Map(ALL_ICONS.map(item => [item.name, item.Icon]));

export const CONTEXT_ICONS = ALL_ICONS;
export const DEFAULT_CONTEXT_ICON = 'Lightbulb';

interface CustomizeDialogProps {
  selectedIcon?: string;
  selectedColor?: string | null;
  selectedCollaborate?: boolean | null;
  selectedExecute?: boolean | null;
  showFlagsPicker?: boolean;
  onCollaborateChange?: (value: boolean) => void;
  onExecuteChange?: (value: boolean) => void;
  onSelect: (selection: IconSelection) => void;
  onClose: () => void;
}

export function CustomizeDialog({
  selectedIcon,
  selectedColor,
  selectedCollaborate,
  selectedExecute,
  showFlagsPicker,
  onCollaborateChange,
  onExecuteChange,
  onSelect,
  onClose,
}: CustomizeDialogProps) {
  const [currentIcon, setCurrentIcon] = useState(selectedIcon || '');

  const {
    searchInputRef,
    hoveredIcon,
    showAll,
    searchQuery,
    displayedIcons,
    isSearching,
    handleShowMore,
    handleShowLess,
    handleSearchChange,
    handleIconHover,
  } = useIconPickerBehavior(
    (icon) => setCurrentIcon(icon),
    onClose,
    ALL_ICONS,
    CURATED_ICONS
  );

  const {
    currentColor,
    customColor,
    isCustomColor,
    handleColorSelect,
    handleCustomColorChange,
  } = useIconPickerColors(selectedColor);

  const handleIconSelect = (iconName: string) => {
    setCurrentIcon(iconName);
  };

  const handleConfirm = () => {
    if (currentIcon) {
      onSelect({
        icon: currentIcon,
        color: currentColor || undefined,
        ...(showFlagsPicker && {
          collaborate: selectedCollaborate === true,
          execute: selectedExecute === true,
        }),
      });
      onClose();
    }
  };

  return (
    <Modal title="Customize" onClose={onClose}>
        <IconGrid
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          displayedIcons={displayedIcons}
          currentIcon={currentIcon}
          onIconSelect={handleIconSelect}
          onIconHover={handleIconHover}
          hoveredIcon={hoveredIcon}
          isSearching={isSearching}
          showAll={showAll}
          onShowMore={handleShowMore}
          onShowLess={handleShowLess}
        />

        <ColorPicker
          currentColor={currentColor}
          customColor={customColor}
          isCustomColor={isCustomColor}
          onColorSelect={handleColorSelect}
          onCustomColorChange={handleCustomColorChange}
        />

        {showFlagsPicker && onCollaborateChange && onExecuteChange && (
          <ContextFlagsCheckboxes
            collaborate={selectedCollaborate === true}
            execute={selectedExecute === true}
            onCollaborateChange={onCollaborateChange}
            onExecuteChange={onExecuteChange}
          />
        )}

        <div className="icon-picker-footer">
          <div className="icon-picker-preview-icon">
            {currentIcon && (
              <span style={{ color: currentColor || 'inherit' }}>
                {createElement(getIconByName(currentIcon) || TriangleAlert, { size: 24 })}
              </span>
            )}
          </div>
          <div className="icon-picker-actions">
            <button className="icon-picker-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="icon-picker-confirm"
              onClick={handleConfirm}
              disabled={!currentIcon}
            >
              Apply
            </button>
          </div>
        </div>
    </Modal>
  );
}

// Helper to get icon component by name
// Returns TriangleAlert (warning) as fallback for unknown icons
export function getIconByName(name: string): LucideIcon | null {
  const icon = ICON_MAP.get(name);
  if (icon) return icon;
  // Fallback for old FontAwesome icon names - return warning icon
  if (name && name.length > 0) return TriangleAlert;
  return null;
}

// Helper to render an icon by name (convenience function)
export function renderIcon(name: string, size: number = 16): React.ReactNode {
  const Icon = getIconByName(name);
  if (!Icon) return null;
  return createElement(Icon, { size });
}
