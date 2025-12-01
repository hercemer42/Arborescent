import { createElement, ComponentType } from 'react';
import * as LucideIcons from 'lucide-react';
import { LucideProps, TriangleAlert } from 'lucide-react';
import { useIconPickerBehavior } from './hooks/useIconPickerBehavior';
import './IconPicker.css';

// Type for Lucide icon components
export type LucideIcon = ComponentType<LucideProps>;

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

export const CONTEXT_ICONS = ALL_ICONS;
export const DEFAULT_CONTEXT_ICON = 'Lightbulb';

interface IconPickerProps {
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ selectedIcon, onSelect, onClose }: IconPickerProps) {
  const {
    dialogRef,
    searchInputRef,
    hoveredIcon,
    showAll,
    searchQuery,
    displayedIcons,
    isSearching,
    handleIconClick,
    handleShowMore,
    handleShowLess,
    handleSearchChange,
    handleIconHover,
  } = useIconPickerBehavior(onSelect, onClose, ALL_ICONS, CURATED_ICONS);

  return (
    <div className="icon-picker-overlay">
      <div ref={dialogRef} className="icon-picker-dialog">
        <div className="icon-picker-header">
          <h3>Choose an icon</h3>
          <button className="icon-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="icon-picker-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search icons..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="icon-picker-search-input"
          />
        </div>

        <div className="icon-picker-grid">
          {displayedIcons.map(({ Icon, name }) => (
            <button
              key={name}
              className={`icon-picker-item ${selectedIcon === name ? 'selected' : ''}`}
              onClick={() => handleIconClick(name)}
              onMouseEnter={() => handleIconHover(name)}
              onMouseLeave={() => handleIconHover(null)}
              title={name}
            >
              <Icon size={16} />
            </button>
          ))}
          {displayedIcons.length === 0 && (
            <div className="icon-picker-no-results">No icons found</div>
          )}
        </div>

        <div className="icon-picker-footer">
          <div className="icon-picker-preview">
            {hoveredIcon || '\u00A0'}
          </div>
          {!isSearching && (
            <button
              className="icon-picker-toggle"
              onClick={showAll ? handleShowLess : handleShowMore}
            >
              {showAll ? 'Show less' : 'More icons'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to get icon component by name
// Returns TriangleAlert (warning) as fallback for unknown icons
export function getIconByName(name: string): LucideIcon | null {
  const found = CONTEXT_ICONS.find(item => item.name === name);
  if (found) {
    return found.Icon;
  }
  // Fallback for old FontAwesome icon names - return warning icon
  if (name && name.length > 0) {
    return TriangleAlert;
  }
  return null;
}

// Helper to render an icon by name (convenience function)
export function renderIcon(name: string, size: number = 16): React.ReactNode {
  const Icon = getIconByName(name);
  if (!Icon) return null;
  return createElement(Icon, { size });
}
