export interface InlineUrlMatch {
  url: string;
  start: number;
  end: number;
}

const INLINE_URL_PATTERN = /(?:https?:\/\/|vscode:\/\/|mailto:)[^\s]+/g;

const TERMINATOR_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', '>']);

function trimTrailingTerminators(raw: string): string {
  let trimmed = raw;
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    if (TERMINATOR_PUNCTUATION.has(last)) {
      trimmed = trimmed.slice(0, -1);
      continue;
    }
    if (last === ')' && !trimmed.includes('(')) {
      trimmed = trimmed.slice(0, -1);
      continue;
    }
    if (last === ']' && !trimmed.includes('[')) {
      trimmed = trimmed.slice(0, -1);
      continue;
    }
    break;
  }
  return trimmed;
}

export function findInlineUrls(text: string): InlineUrlMatch[] {
  if (!text) return [];

  const matches: InlineUrlMatch[] = [];
  for (const match of text.matchAll(INLINE_URL_PATTERN)) {
    const start = match.index ?? 0;
    const trimmed = trimTrailingTerminators(match[0]);
    if (trimmed.length === 0) continue;
    matches.push({ url: trimmed, start, end: start + trimmed.length });
  }
  return matches;
}
