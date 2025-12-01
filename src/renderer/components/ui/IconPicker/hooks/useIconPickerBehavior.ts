import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useDialogBehavior } from '../../../../hooks';
import { LucideIcon } from '../IconPicker';

interface IconItem {
  Icon: LucideIcon;
  name: string;
}

export function useIconPickerBehavior(
  onSelect: (iconName: string) => void,
  onClose: () => void,
  allIcons: IconItem[],
  curatedIcons: IconItem[]
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useDialogBehavior(dialogRef, onClose);

  // Filter icons based on search query and showAll state
  const displayedIcons = useMemo(() => {
    const baseIcons = showAll ? allIcons : curatedIcons;

    if (!searchQuery.trim()) {
      return baseIcons;
    }

    const query = searchQuery.toLowerCase().trim();
    return allIcons.filter(({ name }) => name.toLowerCase().includes(query));
  }, [showAll, searchQuery, allIcons, curatedIcons]);

  // Focus search input on open
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleIconClick = useCallback((iconName: string) => {
    onSelect(iconName);
    onClose();
  }, [onSelect, onClose]);

  const handleShowMore = useCallback(() => {
    setShowAll(true);
    setSearchQuery('');
  }, []);

  const handleShowLess = useCallback(() => {
    setShowAll(false);
    setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleIconHover = useCallback((iconName: string | null) => {
    setHoveredIcon(iconName);
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  return {
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
  };
}
