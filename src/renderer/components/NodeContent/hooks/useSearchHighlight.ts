import { useMemo } from 'react';
import { useSearchStore } from '../../../store/search/searchStore';

interface SearchHighlightResult {
  hasMatch: boolean;
  isCurrentMatch: boolean;
  highlightedContent: string | null;
}

export function useSearchHighlight(
  nodeId: string,
  content: string,
  isSelected: boolean
): SearchHighlightResult {
  const isSearchOpen = useSearchStore((state) => state.isOpen);
  const query = useSearchStore((state) => state.query);
  const matchingNodeIdsSet = useSearchStore((state) => state.matchingNodeIdsSet);
  const matchingNodeIds = useSearchStore((state) => state.matchingNodeIds);
  const currentMatchIndex = useSearchStore((state) => state.currentMatchIndex);

  return useMemo(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || (isSelected && !isSearchOpen)) {
      return { hasMatch: false, isCurrentMatch: false, highlightedContent: null };
    }

    const hasMatch = matchingNodeIdsSet.has(nodeId);
    const isCurrentMatch = matchingNodeIds[currentMatchIndex] === nodeId;

    if (!hasMatch) {
      return { hasMatch: false, isCurrentMatch: false, highlightedContent: null };
    }

    const highlightedContent = highlightMatches(content, trimmedQuery, isCurrentMatch);

    return { hasMatch, isCurrentMatch, highlightedContent };
  }, [nodeId, content, query, matchingNodeIdsSet, matchingNodeIds, currentMatchIndex, isSelected, isSearchOpen]);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightMatches(content: string, query: string, isCurrentMatch: boolean): string {
  const escaped = escapeHtml(content);
  const escapedQuery = escapeHtml(query);

  const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
  const className = isCurrentMatch ? 'search-highlight search-highlight-current' : 'search-highlight';

  return escaped.replace(regex, `<mark class="${className}">$1</mark>`);
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
