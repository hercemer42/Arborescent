export const ARBORESCENT_MARKER_PREFIX = '<!-- ARBORESCENT_NODE: ';
export const ARBORESCENT_MARKER_SUFFIX = ' -->';
export const ARBORESCENT_MARKER_REGEX = /^<!-- ARBORESCENT_NODE: ([0-9a-fA-F-]{36})(?: ([a-z-]+))? -->\s*\n?/;

export const ARBORESCENT_TARGET_MARKER_PREFIX = '<!-- ARBORESCENT_TARGET: ';
export const ARBORESCENT_TARGET_MARKER_SUFFIX = ' -->';
export const ARBORESCENT_TARGET_MARKER_REGEX = /^<!-- ARBORESCENT_TARGET: ([0-9a-fA-F-]{36}) -->\s*\n?/;

export function buildArborescentMarker(nodeUuid: string, source?: string): string {
  const sourceToken = source ? ` ${source}` : '';
  return `${ARBORESCENT_MARKER_PREFIX}${nodeUuid}${sourceToken}${ARBORESCENT_MARKER_SUFFIX}\n`;
}

export function buildArborescentTargetMarker(nodeUuid: string): string {
  return `${ARBORESCENT_TARGET_MARKER_PREFIX}${nodeUuid}${ARBORESCENT_TARGET_MARKER_SUFFIX}\n`;
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

  for (let iteration = 0; iteration < 2; iteration++) {
    if (!bindingNodeUuid) {
      const match = remaining.match(ARBORESCENT_MARKER_REGEX);
      if (match) {
        bindingNodeUuid = match[1];
        bindingSource = match[2] ?? null;
        remaining = remaining.slice(match[0].length);
        continue;
      }
    }
    if (!targetNodeUuid) {
      const match = remaining.match(ARBORESCENT_TARGET_MARKER_REGEX);
      if (match) {
        targetNodeUuid = match[1];
        remaining = remaining.slice(match[0].length);
        continue;
      }
    }
    break;
  }

  return { bindingNodeUuid, bindingSource, targetNodeUuid, stripped: remaining };
}
