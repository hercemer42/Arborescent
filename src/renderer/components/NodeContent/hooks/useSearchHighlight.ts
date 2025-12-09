import { useMemo } from 'react';
import { useSearchStore } from '../../../store/search/searchStore';

interface SearchHighlightResult {
  hasMatch: boolean;
  isCurrentMatch: boolean;
  highlightedContent: string | null;
}

/**
 * Hook to compute search highlighting for node content.
 * Returns highlighted HTML when there's a match, null otherwise.
 */
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

    // No highlighting if no query or no matches
    // Skip selected nodes only when search is NOT open (normal editing mode)
    if (!trimmedQuery || (isSelected && !isSearchOpen)) {
      return { hasMatch: false, isCurrentMatch: false, highlightedContent: null };
    }

    const hasMatch = matchingNodeIdsSet.has(nodeId);
    const isCurrentMatch = matchingNodeIds[currentMatchIndex] === nodeId;

    if (!hasMatch) {
      return { hasMatch: false, isCurrentMatch: false, highlightedContent: null };
    }

    // Create highlighted HTML by wrapping matches in mark tags
    const highlightedContent = highlightMatches(content, trimmedQuery, isCurrentMatch);

    return { hasMatch, isCurrentMatch, highlightedContent };
  }, [nodeId, content, query, matchingNodeIdsSet, matchingNodeIds, currentMatchIndex, isSelected, isSearchOpen]);
}

/**
 * Escapes HTML special characters to prevent DOM breakage when using dangerouslySetInnerHTML.
 * Without this, content like "<div>" or "&nbsp;" would be interpreted as HTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Highlights all occurrences of query in content, returning HTML string
 */
function highlightMatches(content: string, query: string, isCurrentMatch: boolean): string {
  const escaped = escapeHtml(content);
  const escapedQuery = escapeHtml(query);

  // Case-insensitive search and replace
  const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');
  const className = isCurrentMatch ? 'search-highlight search-highlight-current' : 'search-highlight';

  return escaped.replace(regex, `<mark class="${className}">$1</mark>`);
}

/**
 * Escapes special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
