/**
 * URL utility functions
 * Pure functions for URL manipulation and normalization
 */

/**
 * Check if input looks like a URL (has domain-like structure)
 */
function looksLikeUrl(input: string): boolean {
  // Has a protocol
  if (/^[a-zA-Z]+:\/\//.test(input)) return true;

  // Has a TLD-like pattern (e.g., "example.com", "foo.co.uk")
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/.test(input)) return true;

  // Starts with localhost or IP address
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?/.test(input)) return true;

  return false;
}

/**
 * Normalize a URL by adding https:// if no protocol is specified.
 * If input doesn't look like a URL, treat it as a search query.
 * @param input - The URL or search query
 * @returns The normalized URL or Ecosia search URL
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!looksLikeUrl(trimmed)) {
    // Treat as search query
    return `https://www.ecosia.org/search?q=${encodeURIComponent(trimmed)}`;
  }

  // Add https:// if no protocol
  if (!trimmed.match(/^[a-zA-Z]+:\/\//)) {
    return 'https://' + trimmed;
  }

  return trimmed;
}
