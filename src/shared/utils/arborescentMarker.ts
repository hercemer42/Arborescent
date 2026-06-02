export const ARBORESCENT_MARKER_PREFIX = '<!-- ARBORESCENT_NODE: ';
export const ARBORESCENT_MARKER_SUFFIX = ' -->';
export const ARBORESCENT_MARKER_REGEX = /<!-- ARBORESCENT_NODE: ([0-9a-fA-F-]{36})(?: ([a-z-]+))? -->\s*\n?/;

export const ARBORESCENT_TARGET_MARKER_PREFIX = '<!-- ARBORESCENT_TARGET: ';
export const ARBORESCENT_TARGET_MARKER_SUFFIX = ' -->';
export const ARBORESCENT_TARGET_MARKER_REGEX = /<!-- ARBORESCENT_TARGET: ([0-9a-fA-F-]{36}) -->\s*\n?/;

export function buildArborescentMarker(nodeUuid: string, source?: string): string {
  const sourceToken = source ? ` ${source}` : '';
  return `${ARBORESCENT_MARKER_PREFIX}${nodeUuid}${sourceToken}${ARBORESCENT_MARKER_SUFFIX}\n`;
}

export function buildArborescentTargetMarker(nodeUuid: string): string {
  return `${ARBORESCENT_TARGET_MARKER_PREFIX}${nodeUuid}${ARBORESCENT_TARGET_MARKER_SUFFIX}\n`;
}

function spliceOutMatch(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return text.slice(0, start) + text.slice(start + match[0].length);
}

export function extractArborescentMarkers(prompt: string): {
  bindingNodeUuid: string | null;
  bindingSource: string | null;
  targetNodeUuid: string | null;
  stripped: string;
} {
  let bindingNodeUuid: string | null = null;
  let bindingSource: string | null = null;
  let targetNodeUuid: string | null = null;
  let remaining = prompt;

  const bindingMatch = remaining.match(ARBORESCENT_MARKER_REGEX);
  if (bindingMatch) {
    bindingNodeUuid = bindingMatch[1];
    bindingSource = bindingMatch[2] ?? null;
    remaining = spliceOutMatch(remaining, bindingMatch);
  }

  const targetMatch = remaining.match(ARBORESCENT_TARGET_MARKER_REGEX);
  if (targetMatch) {
    targetNodeUuid = targetMatch[1];
    remaining = spliceOutMatch(remaining, targetMatch);
  }

  return { bindingNodeUuid, bindingSource, targetNodeUuid, stripped: remaining };
}
