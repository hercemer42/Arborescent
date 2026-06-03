import { describe, it, expect } from 'vitest';
import { resolveStepMode, MODE_POLICY, type StepMode } from '../permissionGate';

// Pins the shared mode policy table contract — the single home for the
// mode-to-permissions matrix consumed by the submit gate, the announce gate,
// mutation authority, and the prompt dispatch.

const ALL_MODES: StepMode[] = ['collaborate', 'both', 'execute', 'action'];
const ADDITIVE = ['add-child', 'append', 'mark-complete'];
const ALL_KINDS = [...ADDITIVE, 'set-content', 'delete', 'move', 'set-metadata'];

describe('resolveStepMode — flag pairs map to the four named modes', () => {
  it('collaborate=true, execute=false resolves to collaborate', () => {
    expect(resolveStepMode({ collaborate: true, execute: false })).toBe('collaborate');
  });

  it('collaborate=true, execute=true resolves to both', () => {
    expect(resolveStepMode({ collaborate: true, execute: true })).toBe('both');
  });

  it('collaborate=false, execute=true resolves to execute', () => {
    expect(resolveStepMode({ collaborate: false, execute: true })).toBe('execute');
  });

  it('collaborate=false, execute=false resolves to action', () => {
    expect(resolveStepMode({ collaborate: false, execute: false })).toBe('action');
  });
});

describe('MODE_POLICY — completion channel ownership', () => {
  it('pure collaborate completes via submit_step_output', () => {
    expect(MODE_POLICY.collaborate.completionTool).toBe('submit_step_output');
  });

  it('collaborate & execute completes via announce_step_done', () => {
    expect(MODE_POLICY.both.completionTool).toBe('announce_step_done');
  });

  it('execute-only completes via announce_step_done', () => {
    expect(MODE_POLICY.execute.completionTool).toBe('announce_step_done');
  });

  it('action mode completes via announce_step_done', () => {
    expect(MODE_POLICY.action.completionTool).toBe('announce_step_done');
  });
});

describe('MODE_POLICY — direct-apply mutation kinds per mode', () => {
  it('collaborate permits no direct-apply mutations (the submit rebuild is the sole write channel)', () => {
    expect(MODE_POLICY.collaborate.directApplyMutationKinds).toEqual([]);
  });

  it('both permits exactly the additive kinds', () => {
    expect([...MODE_POLICY.both.directApplyMutationKinds].sort()).toEqual([...ADDITIVE].sort());
  });

  it('execute permits no mutations', () => {
    expect(MODE_POLICY.execute.directApplyMutationKinds).toEqual([]);
  });

  it('action permits no mutations', () => {
    expect(MODE_POLICY.action.directApplyMutationKinds).toEqual([]);
  });
});

describe('MODE_POLICY — proposal-route mutation kinds per mode (user-reviewed queue stays permissive)', () => {
  it('collaborate proposes any mutation kind (the proposal queue is the human in the loop)', () => {
    expect([...MODE_POLICY.collaborate.proposalMutationKinds].sort()).toEqual([...ALL_KINDS].sort());
  });

  it('both proposes only the additive kinds', () => {
    expect([...MODE_POLICY.both.proposalMutationKinds].sort()).toEqual([...ADDITIVE].sort());
  });

  it('execute proposes nothing', () => {
    expect(MODE_POLICY.execute.proposalMutationKinds).toEqual([]);
  });

  it('action proposes nothing', () => {
    expect(MODE_POLICY.action.proposalMutationKinds).toEqual([]);
  });
});

describe('MODE_POLICY — table invariant (the acceptance criterion, asserted directly)', () => {
  it('every mode maps to exactly one completion tool', () => {
    for (const mode of ALL_MODES) {
      expect(['submit_step_output', 'announce_step_done']).toContain(MODE_POLICY[mode].completionTool);
    }
  });

  it('no mode permits both submit_step_output and incremental direct-apply writes', () => {
    for (const mode of ALL_MODES) {
      if (MODE_POLICY[mode].completionTool === 'submit_step_output') {
        expect(MODE_POLICY[mode].directApplyMutationKinds).toHaveLength(0);
      }
    }
  });

  it('all four modes are present and no extras exist', () => {
    expect(Object.keys(MODE_POLICY).sort()).toEqual([...ALL_MODES].sort());
  });
});

describe('MODE_POLICY — refusal copy names the permitted alternative', () => {
  it('non-collaborate modes refuse submit_step_output pointing at announce_step_done', () => {
    for (const mode of ['both', 'execute', 'action'] as StepMode[]) {
      expect(MODE_POLICY[mode].submitRefusal).toMatch(/announce_step_done/);
    }
  });

  it('collaborate refuses announce_step_done pointing at submit_step_output', () => {
    expect(MODE_POLICY.collaborate.announceRefusal).toMatch(/submit_step_output/);
  });
});
