import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useSearchBar } from './hooks/useSearchBar';
import './SearchBar.css';

export function SearchBar() {
  const {
    inputRef,
    isOpen,
    inputValue,
    totalMatches,
    matchDisplay,
    handleInputChange,
    handleKeyDown,
    handlePrevClick,
    handleNextClick,
    closeSearch,
  } = useSearchBar();

  if (!isOpen) return null;

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Search..."
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />
      {matchDisplay && (
        <span className="search-match-count">{matchDisplay}</span>
      )}
      <button
        className="search-nav-button"
        onClick={handlePrevClick}
        disabled={totalMatches === 0}
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp size={16} />
      </button>
      <button
        className="search-nav-button"
        onClick={handleNextClick}
        disabled={totalMatches === 0}
        title="Next match (Enter)"
      >
        <ChevronDown size={16} />
      </button>
      <button
        className="search-close-button"
        onClick={closeSearch}
        title="Close (Escape)"
      >
        <X size={16} />
      </button>
    </div>
  );
}
