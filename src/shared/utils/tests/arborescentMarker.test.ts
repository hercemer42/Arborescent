import { describe, it, expect } from 'vitest';
import {
  buildArborescentMarker,
  extractAndStripMarker,
  ARBORESCENT_MARKER_PREFIX,
  ARBORESCENT_MARKER_SUFFIX,
} from '../arborescentMarker';

const SAMPLE_UUID = '11111111-2222-3333-4444-555555555555';

describe('buildArborescentMarker', () => {
  it('emits an HTML comment line followed by a newline', () => {
    const marker = buildArborescentMarker(SAMPLE_UUID);
    expect(marker).toBe(`<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\n`);
  });

  it('uses the documented prefix and suffix', () => {
    const marker = buildArborescentMarker(SAMPLE_UUID);
    expect(marker.startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(true);
    expect(marker.includes(ARBORESCENT_MARKER_SUFFIX)).toBe(true);
  });
});

describe('extractAndStripMarker', () => {
  it('extracts the UUID and strips the marker line when the marker is on the first line', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest of prompt`;
    expect(extractAndStripMarker(prompt)).toEqual({
      nodeUuid: SAMPLE_UUID,
      stripped: 'rest of prompt',
    });
  });

  it('returns null and leaves the prompt unchanged when there is no marker', () => {
    expect(extractAndStripMarker('plain prompt body')).toEqual({
      nodeUuid: null,
      stripped: 'plain prompt body',
    });
  });

  it('returns null when the marker is not on the first line', () => {
    const prompt = `some prelude\n<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest`;
    expect(extractAndStripMarker(prompt)).toEqual({
      nodeUuid: null,
      stripped: prompt,
    });
  });

  it('returns null for a malformed marker (wrong UUID shape)', () => {
    const prompt = '<!-- ARBORESCENT_NODE: not-a-uuid -->\nrest';
    expect(extractAndStripMarker(prompt)).toEqual({
      nodeUuid: null,
      stripped: prompt,
    });
  });

  it('strips at most one marker (a second marker further in the body is preserved)', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\n<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest`;
    const result = extractAndStripMarker(prompt);
    expect(result.nodeUuid).toBe(SAMPLE_UUID);
    expect(result.stripped).toBe(`<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest`);
  });

  it('handles an empty prompt without throwing', () => {
    expect(extractAndStripMarker('')).toEqual({ nodeUuid: null, stripped: '' });
  });

  it('handles a prompt that is only the marker line', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\n`;
    expect(extractAndStripMarker(prompt)).toEqual({
      nodeUuid: SAMPLE_UUID,
      stripped: '',
    });
  });
});
