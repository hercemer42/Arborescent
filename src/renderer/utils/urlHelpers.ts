function looksLikeUrl(input: string): boolean {
  if (/^[a-zA-Z]+:\/\//.test(input)) return true;
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/.test(input)) return true;
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?/.test(input)) return true;
  return false;
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!looksLikeUrl(trimmed)) {
    return `https://www.ecosia.org/search?q=${encodeURIComponent(trimmed)}`;
  }

  if (!trimmed.match(/^[a-zA-Z]+:\/\//)) {
    return 'https://' + trimmed;
  }

  return trimmed;
}
