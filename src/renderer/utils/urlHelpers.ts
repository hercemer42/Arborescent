/**
 * URL utility functions
 * Pure functions for URL manipulation and normalization
 */

/**
 * Normalize a URL by adding https:// if no protocol is specified.
 * @param url - The URL to normalize
 * @returns The normalized URL with a protocol
 */
export function normalizeUrl(url: string): string {
  if (!url.match(/^[a-zA-Z]+:\/\//)) {
    return 'https://' + url;
  }
  return url;
}
