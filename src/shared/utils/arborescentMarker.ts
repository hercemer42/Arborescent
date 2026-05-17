export const ARBORESCENT_MARKER_PREFIX = '<!-- ARBORESCENT_NODE: ';
export const ARBORESCENT_MARKER_SUFFIX = ' -->';
export const ARBORESCENT_MARKER_REGEX = /^<!-- ARBORESCENT_NODE: ([0-9a-fA-F-]{36}) -->\s*\n?/;

export function buildArborescentMarker(nodeUuid: string): string {
  return `${ARBORESCENT_MARKER_PREFIX}${nodeUuid}${ARBORESCENT_MARKER_SUFFIX}\n`;
}

export function extractAndStripMarker(prompt: string): {
  nodeUuid: string | null;
  stripped: string;
} {
  const match = prompt.match(ARBORESCENT_MARKER_REGEX);
  if (!match) return { nodeUuid: null, stripped: prompt };
  return { nodeUuid: match[1], stripped: prompt.slice(match[0].length) };
}
