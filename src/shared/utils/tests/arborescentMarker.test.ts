import { describe, it, expect } from 'vitest';
import {
  buildArborescentMarker,
  buildArborescentTargetMarker,
  extractArborescentMarkers,
  ARBORESCENT_MARKER_PREFIX,
  ARBORESCENT_MARKER_SUFFIX,
  ARBORESCENT_TARGET_MARKER_PREFIX,
  ARBORESCENT_TARGET_MARKER_SUFFIX,
} from '../arborescentMarker';

const SAMPLE_UUID = '11111111-2222-3333-4444-555555555555';
const TARGET_UUID = '22222222-3333-4444-5555-666666666666';

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

  it('includes a source token between the UUID and the closing delimiter when one is provided', () => {
    // The source token is the channel the dispatcher uses to distinguish a
    // user-driven workflow-start (dialog) from a workflow-advance hand-off
    // (silent). Sticking it inline in the marker keeps everything the hook
    // script needs in one place: parse the marker, forward source through.
    const marker = buildArborescentMarker(SAMPLE_UUID, 'workflow-advance');
    expect(marker).toBe(`<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} workflow-advance -->\n`);
  });

  it('emits the no-source form when source is omitted — backward compatible with the US-B grammar', () => {
    const marker = buildArborescentMarker(SAMPLE_UUID);
    expect(marker).toBe(`<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\n`);
  });

  it('emits the workflow-start source distinct from workflow-advance', () => {
    const startMarker = buildArborescentMarker(SAMPLE_UUID, 'workflow-start');
    const advanceMarker = buildArborescentMarker(SAMPLE_UUID, 'workflow-advance');
    expect(startMarker).not.toBe(advanceMarker);
    expect(startMarker).toContain('workflow-start');
    expect(advanceMarker).toContain('workflow-advance');
  });
});

describe('buildArborescentTargetMarker', () => {
  it('emits an ARBORESCENT_TARGET HTML comment line followed by a newline', () => {
    const marker = buildArborescentTargetMarker(TARGET_UUID);
    expect(marker).toBe(`<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\n`);
  });

  it('uses the documented target prefix and suffix', () => {
    const marker = buildArborescentTargetMarker(TARGET_UUID);
    expect(marker.startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(true);
    expect(marker.includes(ARBORESCENT_TARGET_MARKER_SUFFIX)).toBe(true);
  });

  it('is grammatically distinct from the binding marker so the two never collide', () => {
    // The two marker grammars carry different semantics — a target must never
    // be parsed as a binding nor vice versa, otherwise routing reverts to the
    // pre-US-B behavior where any send mutates the session binding.
    const binding = buildArborescentMarker(SAMPLE_UUID);
    const target = buildArborescentTargetMarker(SAMPLE_UUID);
    expect(binding).not.toBe(target);
    expect(target.startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(false);
    expect(binding.startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(false);
  });
});

describe('extractArborescentMarkers — both markers together', () => {
  it('extracts binding alone when only the binding marker is present', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: 'rest',
    });
  });

  it('extracts target alone when only the target marker is present', () => {
    const prompt = `<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: TARGET_UUID,
      stripped: 'rest',
    });
  });

  it('returns both nulls and the prompt unchanged when neither marker is present', () => {
    expect(extractArborescentMarkers('plain prompt body')).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: 'plain prompt body',
    });
  });

  it('handles an empty prompt without throwing', () => {
    expect(extractArborescentMarkers('')).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: '',
    });
  });

  it('strips both markers when both are stacked at the top, in either order', () => {
    // The hook script always emits at most one of each grammar at the prompt
    // head — independent of order — and Claude must never see either marker
    // text in the conversation. Tolerating both orders prevents the marker
    // ordering from becoming an undocumented part of the protocol.
    const bindingFirst =
      `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\n<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\nrest`;
    const targetFirst =
      `<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\n<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest`;

    expect(extractArborescentMarkers(bindingFirst)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: null,
      targetNodeUuid: TARGET_UUID,
      stripped: 'rest',
    });
    expect(extractArborescentMarkers(targetFirst)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: null,
      targetNodeUuid: TARGET_UUID,
      stripped: 'rest',
    });
  });

  it('returns null for a target marker that is not on the first line', () => {
    const prompt = `prelude\n<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: prompt,
    });
  });

  it('returns null for a malformed target marker (wrong UUID shape) and leaves the prompt unchanged', () => {
    const prompt = '<!-- ARBORESCENT_TARGET: not-a-uuid -->\nrest';
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: prompt,
    });
  });

  it('handles a prompt that is only a target marker — strips to empty', () => {
    const prompt = `<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\n`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: TARGET_UUID,
      stripped: '',
    });
  });

  it('strips at most one of each marker — duplicate target lines remain in the body', () => {
    const prompt =
      `<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\n<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\nrest`;
    const result = extractArborescentMarkers(prompt);
    expect(result.targetNodeUuid).toBe(TARGET_UUID);
    expect(result.stripped).toBe(`<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\nrest`);
  });
});

describe('extractArborescentMarkers — binding marker source field (US-C)', () => {
  // The source token rides on the binding marker so the dispatcher can tell
  // a user-driven workflow-start (dialog on rebind-needed) apart from a
  // workflow-advance hand-off (silent rebind). The hook script parses it and
  // forwards through to register-binding.

  it('extracts the source token when the binding marker carries one', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} workflow-advance -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: 'workflow-advance',
      targetNodeUuid: null,
      stripped: 'rest',
    });
  });

  it('extracts workflow-start as a distinct source value', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} workflow-start -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: 'workflow-start',
      targetNodeUuid: null,
      stripped: 'rest',
    });
  });

  it('returns bindingSource=null for a binding marker without a source — preserves US-B grammar reading', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: 'rest',
    });
  });

  it('still strips the full marker line including the source token', () => {
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} workflow-advance -->\nbody text`;
    const result = extractArborescentMarkers(prompt);
    expect(result.stripped).toBe('body text');
  });

  it('coexists with the target marker — both can carry their respective payloads', () => {
    const prompt =
      `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} workflow-advance -->\n<!-- ARBORESCENT_TARGET: ${TARGET_UUID} -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: SAMPLE_UUID,
      bindingSource: 'workflow-advance',
      targetNodeUuid: TARGET_UUID,
      stripped: 'rest',
    });
  });

  it('a malformed source token (uppercase, whitespace) leaves the binding marker unparsed', () => {
    // Source values are lowercase kebab — the regex must not match exotic input
    // so the dispatcher cannot be steered with a hand-crafted prompt.
    const prompt = `<!-- ARBORESCENT_NODE: ${SAMPLE_UUID} Workflow-Advance -->\nrest`;
    expect(extractArborescentMarkers(prompt)).toEqual({
      bindingNodeUuid: null,
      bindingSource: null,
      targetNodeUuid: null,
      stripped: prompt,
    });
  });
});
