// A live PTY chunk can overlap output the replay already wrote, because the
// buffered-output read and the live data channel are not ordered against each
// other. Given the chunk's end offset (cumulative output length including this
// chunk) and the replay watermark (output length already written), return only
// the portion that has not been shown yet.
//
// A chunk with no offset cannot be deduped, so it is written verbatim — the
// renderer falls back to live-only behaviour rather than dropping output.
export function clipChunkAfterWatermark(
  data: string,
  endOffset: number | undefined,
  watermark: number,
): string {
  if (endOffset === undefined) return data;
  const startOffset = endOffset - data.length;
  if (startOffset >= watermark) return data;
  if (endOffset <= watermark) return '';
  return data.slice(watermark - startOffset);
}
