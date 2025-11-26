import { useEffect, useRef, useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition, library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import './IconPicker.css';

// Add all solid icons to the library
library.add(fas);

// Curated list of 50 common/useful icons for context marking
const CURATED_ICON_NAMES = [
  // Ideas & Knowledge
  'lightbulb', 'brain', 'graduation-cap', 'book', 'bookmark',
  // Status & Priority
  'star', 'flag', 'bell', 'circle-exclamation', 'triangle-exclamation',
  // Actions & Tasks
  'check', 'circle-check', 'list-check', 'clipboard', 'thumbtack',
  // Objects
  'key', 'lock', 'unlock', 'gear', 'wrench',
  // Communication
  'comment', 'comments', 'envelope', 'bullhorn', 'quote-left',
  // Files & Data
  'file', 'folder', 'database', 'code', 'terminal',
  // People & Users
  'user', 'users', 'user-gear', 'address-book', 'id-card',
  // Symbols
  'heart', 'bolt', 'fire', 'gem', 'crown',
  // Navigation & Location
  'location-dot', 'compass', 'map', 'route', 'signs-post',
  // Misc
  'tag', 'tags', 'puzzle-piece', 'link', 'paperclip',
];

// Convert camelCase key to kebab-case name
function keyToName(key: string): string {
  return key.replace(/^fa/, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

// Get all solid icons as an array sorted by name
function getAllSolidIcons(): { icon: IconDefinition; name: string }[] {
  return Object.entries(fas)
    .filter(([key]) => key.startsWith('fa') && key !== 'fas' && key !== 'prefix')
    .map(([key, icon]) => ({
      icon: icon as IconDefinition,
      name: keyToName(key),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Get curated icons in the order defined above
function getCuratedIcons(): { icon: IconDefinition; name: string }[] {
  const allIcons = getAllSolidIcons();
  const iconMap = new Map(allIcons.map(i => [i.name, i]));

  return CURATED_ICON_NAMES
    .map(name => iconMap.get(name))
    .filter((i): i is { icon: IconDefinition; name: string } => i !== undefined);
}

const ALL_ICONS = getAllSolidIcons();
const CURATED_ICONS = getCuratedIcons();

export const CONTEXT_ICONS = ALL_ICONS; // Export all for getIconByName lookup
export const DEFAULT_CONTEXT_ICON = 'lightbulb';

interface IconPickerProps {
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ selectedIcon, onSelect, onClose }: IconPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter icons based on search query and showAll state
  const displayedIcons = useMemo(() => {
    const baseIcons = showAll ? ALL_ICONS : CURATED_ICONS;

    if (!searchQuery.trim()) {
      return baseIcons;
    }

    const query = searchQuery.toLowerCase().trim();
    return ALL_ICONS.filter(({ name }) => name.includes(query));
  }, [showAll, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    // Focus search input on open
    searchInputRef.current?.focus();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleIconClick = (iconName: string) => {
    onSelect(iconName);
    onClose();
  };

  const handleShowMore = () => {
    setShowAll(true);
    setSearchQuery('');
  };

  const handleShowLess = () => {
    setShowAll(false);
    setSearchQuery('');
  };

  const isSearching = searchQuery.trim().length > 0;

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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="icon-picker-search-input"
          />
        </div>

        <div className="icon-picker-grid">
          {displayedIcons.map(({ icon, name }) => (
            <button
              key={name}
              className={`icon-picker-item ${selectedIcon === name ? 'selected' : ''}`}
              onClick={() => handleIconClick(name)}
              onMouseEnter={() => setHoveredIcon(name)}
              onMouseLeave={() => setHoveredIcon(null)}
              title={name}
            >
              <FontAwesomeIcon icon={icon} />
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

// Helper to get icon definition by name
export function getIconByName(name: string): IconDefinition | null {
  const found = CONTEXT_ICONS.find(item => item.name === name);
  return found?.icon || null;
}
