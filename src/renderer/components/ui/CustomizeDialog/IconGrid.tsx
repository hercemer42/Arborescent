import type { RefObject } from 'react';
import type { LucideIcon } from './CustomizeDialog';

interface IconGridProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  displayedIcons: { Icon: LucideIcon; name: string }[];
  currentIcon: string;
  onIconSelect: (name: string) => void;
  onIconHover: (name: string | null) => void;
  hoveredIcon: string | null;
  isSearching: boolean;
  showAll: boolean;
  onShowMore: () => void;
  onShowLess: () => void;
}

/**
 * Search input + icon grid + "more icons" toggle + hovered-name preview.
 * Split out of CustomizeDialog so the picker logic reads independently
 * from the color / mode / footer sections.
 */
export function IconGrid({
  searchInputRef,
  searchQuery,
  onSearchChange,
  displayedIcons,
  currentIcon,
  onIconSelect,
  onIconHover,
  hoveredIcon,
  isSearching,
  showAll,
  onShowMore,
  onShowLess,
}: IconGridProps) {
  return (
    <>
      <div className="icon-picker-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="icon-picker-search-input"
        />
      </div>

      <div className="icon-picker-grid">
        {displayedIcons.map(({ Icon, name }) => (
          <button
            key={name}
            className={`icon-picker-item ${currentIcon === name ? 'selected' : ''}`}
            onClick={() => onIconSelect(name)}
            onMouseEnter={() => onIconHover(name)}
            onMouseLeave={() => onIconHover(null)}
            title={name}
          >
            <Icon size={16} />
          </button>
        ))}
        {displayedIcons.length === 0 && (
          <div className="icon-picker-no-results">No icons found</div>
        )}
      </div>

      <div className="icon-picker-icon-footer">
        <div className="icon-picker-preview">
          {hoveredIcon || '\u00A0'}
        </div>
        {!isSearching && (
          <button
            className="icon-picker-toggle"
            onClick={showAll ? onShowLess : onShowMore}
          >
            {showAll ? 'Show less' : 'More icons'}
          </button>
        )}
      </div>
    </>
  );
}
