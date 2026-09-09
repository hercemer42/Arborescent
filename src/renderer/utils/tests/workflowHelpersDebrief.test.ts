import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';

import { getDebriefDestinationId } from '../workflowHelpers';

// The destination lives on the step, and the session binds to the subject, so
// resolution walks up one level exactly as the archive-config resolver does.
// Existence of the target is the caller's problem: the send path omits the
// register and warns, and a dangling id must never reach the session.

const WORKFLOW = 'wwwwwwww-0000-0000-0000-000000000001';
const STEP = 'ssssssss-0000-0000-0000-000000000001';
const OTHER_STEP = 'ssssssss-0000-0000-0000-000000000002';
const SUBJECT = 'aaaaaaaa-0000-0000-0000-000000000001';
const CHILD = 'cccccccc-0000-0000-0000-000000000001';
const FINDINGS = 'ffffffff-0000-0000-0000-000000000001';
const LOOSE = 'llllllll-0000-0000-0000-000000000001';

function makeNode(
  id: string,
  metadata: Record<string, unknown> = {},
  children: string[] = [],
): TreeNode {
  return { id, content: id, children, metadata };
}

interface Fixture {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: Record<string, string[]>;
}

function makeFixture(stepMetadata: Record<string, unknown>): Fixture {
  return {
    nodes: {
      [WORKFLOW]: makeNode(WORKFLOW, { isWorkflow: true, isBlueprint: true }, [STEP, OTHER_STEP]),
      [STEP]: makeNode(STEP, { isBlueprint: true, stepType: 'autonomous', ...stepMetadata }, [SUBJECT]),
      [OTHER_STEP]: makeNode(OTHER_STEP, { isBlueprint: true, stepType: 'autonomous' }, []),
      [SUBJECT]: makeNode(SUBJECT, {}, [CHILD]),
      [CHILD]: makeNode(CHILD),
      [FINDINGS]: makeNode(FINDINGS, { isFindingsRoot: true }),
      [LOOSE]: makeNode(LOOSE),
    },
    ancestorRegistry: {
      [WORKFLOW]: [],
      [STEP]: [WORKFLOW],
      [OTHER_STEP]: [WORKFLOW],
      [SUBJECT]: [WORKFLOW, STEP],
      [CHILD]: [WORKFLOW, STEP, SUBJECT],
      [FINDINGS]: [],
      [LOOSE]: [],
    },
  };
}

describe('getDebriefDestinationId', () => {
  it('reads the destination from the subject parent step', () => {
    const { nodes, ancestorRegistry } = makeFixture({ debriefDestinationId: FINDINGS });
    expect(getDebriefDestinationId(SUBJECT, nodes, ancestorRegistry)).toBe(FINDINGS);
  });

  it('returns undefined when the step declares no destination', () => {
    const { nodes, ancestorRegistry } = makeFixture({});
    expect(getDebriefDestinationId(SUBJECT, nodes, ancestorRegistry)).toBeUndefined();
  });

  it('returns undefined for a node that is not a workflow subject', () => {
    const { nodes, ancestorRegistry } = makeFixture({ debriefDestinationId: FINDINGS });
    expect(getDebriefDestinationId(LOOSE, nodes, ancestorRegistry)).toBeUndefined();
  });

  it('does not inherit the destination down into the subject own children', () => {
    const { nodes, ancestorRegistry } = makeFixture({ debriefDestinationId: FINDINGS });
    expect(getDebriefDestinationId(CHILD, nodes, ancestorRegistry)).toBeUndefined();
  });

  it('does not read a sibling step destination', () => {
    const { nodes, ancestorRegistry } = makeFixture({});
    nodes[OTHER_STEP] = makeNode(OTHER_STEP, { isBlueprint: true, debriefDestinationId: FINDINGS }, []);
    expect(getDebriefDestinationId(SUBJECT, nodes, ancestorRegistry)).toBeUndefined();
  });

  it('returns the raw id even when it resolves to no node, leaving the existence check to the caller', () => {
    const { nodes, ancestorRegistry } = makeFixture({ debriefDestinationId: 'evaporated' });
    expect(getDebriefDestinationId(SUBJECT, nodes, ancestorRegistry)).toBe('evaporated');
  });

  it('returns undefined for an id that resolves to no node at all', () => {
    const { nodes, ancestorRegistry } = makeFixture({ debriefDestinationId: FINDINGS });
    expect(getDebriefDestinationId('missing', nodes, ancestorRegistry)).toBeUndefined();
  });

  it('returns undefined for an empty-string destination rather than treating it as configured', () => {
    const { nodes, ancestorRegistry } = makeFixture({ debriefDestinationId: '' });
    expect(getDebriefDestinationId(SUBJECT, nodes, ancestorRegistry)).toBeUndefined();
  });
});
