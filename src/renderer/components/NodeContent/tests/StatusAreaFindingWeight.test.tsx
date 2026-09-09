import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NodeContent } from '../NodeContent';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore } from '../../../store/tree/treeStore';
import { createPartialMockActions } from '../../../test/helpers/mockStoreActions';
import type { TreeNode } from '@shared/types';

// A finding renders its weight badge in the checkbox position — the same
// substitution a workflow step number already makes — so the checkbox branch is
// never reached. Weight is derived from the back-link children at render time,
// so nothing here reads a stored count.

const ROOT = 'root';
const FINDINGS = 'findings-root';
const FINDING = 'finding-a';
const PLAIN = 'plain-node';

function makeNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata };
}

function backlinkIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `link-${i}`);
}

describe('StatusArea — finding weight badge', () => {
  let store: TreeStore;

  const mockActions = createPartialMockActions({
    selectNode: vi.fn(),
    toggleStatus: vi.fn(),
  });

  // A finding is a direct child of a node stamped isFindingsRoot. It carries a
  // description child plus one hyperlink child per sighting.
  function seed(weight: number) {
    const links = backlinkIds(weight);
    const nodes: Record<string, TreeNode> = {
      [ROOT]: makeNode(ROOT, 'Root', [FINDINGS, PLAIN]),
      [FINDINGS]: makeNode(FINDINGS, 'Findings', [FINDING], { isFindingsRoot: true }),
      [FINDING]: makeNode(FINDING, 'Step prompts under-specify their output', ['desc', ...links], {
        status: 'pending',
        expanded: false,
      }),
      desc: makeNode('desc', 'The prompt named no output format', [], { status: 'pending' }),
      [PLAIN]: makeNode(PLAIN, 'An ordinary node', [], { status: 'pending' }),
    };
    const ancestorRegistry: Record<string, string[]> = {
      [ROOT]: [],
      [FINDINGS]: [ROOT],
      [FINDING]: [ROOT, FINDINGS],
      desc: [ROOT, FINDINGS, FINDING],
      [PLAIN]: [ROOT],
    };
    for (const id of links) {
      nodes[id] = makeNode(id, 'Seen here', [], { isHyperlink: true, linkedNodeId: PLAIN, status: 'pending' });
      ancestorRegistry[id] = [ROOT, FINDINGS, FINDING];
    }

    store.setState({
      nodes,
      rootNodeId: ROOT,
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry,
      workflowExecutionStates: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: mockActions as any,
    });
    return nodes;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTreeStore();
  });

  const renderNode = (node: TreeNode) =>
    render(
      <TreeStoreContext.Provider value={store}>
        <NodeContent node={node} depth={0} />
      </TreeStoreContext.Provider>,
    );

  describe('the badge replaces the checkbox', () => {
    it('renders the badge on a finding', () => {
      const nodes = seed(2);
      const { container } = renderNode(nodes[FINDING]);
      expect(container.querySelector('.finding-weight-badge')).not.toBeNull();
    });

    it('renders the weight as the badge text', () => {
      const nodes = seed(2);
      const { container } = renderNode(nodes[FINDING]);
      expect(container.querySelector('.finding-weight-badge')?.textContent).toBe('2');
    });

    it('renders no status checkbox on a finding', () => {
      const nodes = seed(2);
      const { queryByLabelText } = renderNode(nodes[FINDING]);
      expect(queryByLabelText(/^Status:/)).not.toBeInTheDocument();
    });

    it('renders the hyperlink indicator and no badge on a back-link', () => {
      const nodes = seed(1);
      const { container, queryByLabelText } = renderNode(nodes['link-0']);
      expect(container.querySelector('.hyperlink-indicator')).not.toBeNull();
      expect(container.querySelector('.finding-weight-badge')).toBeNull();
      expect(queryByLabelText(/^Status:/)).not.toBeInTheDocument();
    });

    it('leaves an ordinary node outside a Findings subtree with its checkbox', () => {
      const nodes = seed(2);
      const { container, getByLabelText } = renderNode(nodes[PLAIN]);
      expect(getByLabelText(/^Status:/)).toBeInTheDocument();
      expect(container.querySelector('.finding-weight-badge')).toBeNull();
    });

    it('leaves the Findings node itself with its checkbox — the root is not a finding', () => {
      const nodes = seed(2);
      const { container } = renderNode(nodes[FINDINGS]);
      expect(container.querySelector('.finding-weight-badge')).toBeNull();
    });

    it('renders no badge on a description child, which is not a finding', () => {
      const nodes = seed(2);
      const { container } = renderNode(nodes.desc);
      expect(container.querySelector('.finding-weight-badge')).toBeNull();
    });

    // insertChild inherits isBlueprint down a blueprint chain, so a Findings node
    // parked in a blueprint subtree produces blueprint findings. The badge branch
    // outranks the blueprint branch, which would otherwise render an icon and
    // hide the weight entirely.
    it('renders the badge on a finding that inherited isBlueprint', () => {
      const nodes = seed(2);
      nodes[FINDING] = {
        ...nodes[FINDING],
        metadata: { ...nodes[FINDING].metadata, isBlueprint: true, blueprintIcon: 'star' },
      };
      store.setState({ nodes });

      const { container } = renderNode(nodes[FINDING]);
      expect(container.querySelector('.finding-weight-badge')?.textContent).toBe('2');
      expect(container.querySelector('.blueprint-indicator')).toBeNull();
    });

    // The badge branch outranks the context branches, so a Findings node parked
    // on a context declaration still shows its children's weights rather than
    // returning early with a context icon and no wrapper.
    it('renders the badge on a finding whose Findings node is also a context declaration', () => {
      const nodes = seed(2);
      nodes[FINDINGS] = {
        ...nodes[FINDINGS],
        metadata: { ...nodes[FINDINGS].metadata, isContextDeclaration: true, blueprintIcon: 'lightbulb' },
      };
      store.setState({ nodes });

      const { container } = renderNode(nodes[FINDING]);
      expect(container.querySelector('.finding-weight-badge')?.textContent).toBe('2');
    });
  });

  describe('colour bands ascend with severity', () => {
    it.each([
      [1, 'muted'],
      [3, 'muted'],
      [4, 'amber'],
      [5, 'amber'],
      [6, 'red'],
      [12, 'red'],
    ])('weight %i sits in the %s band', (weight, band) => {
      const nodes = seed(weight as number);
      const { container } = renderNode(nodes[FINDING]);
      const badge = container.querySelector('.finding-weight-badge');
      expect(badge?.className).toContain(`weight-band-${band}`);
    });

    it('counts only back-links, so a description child never raises the band', () => {
      const nodes = seed(3);
      const { container } = renderNode(nodes[FINDING]);
      const badge = container.querySelector('.finding-weight-badge');
      expect(badge?.textContent).toBe('3');
      expect(badge?.className).toContain('weight-band-muted');
    });
  });

  // Every other status-area branch carries these; a finding is an ordinary
  // content node that can be sent to a terminal, so it can be running or carry
  // a broken session link.
  describe('indicators a finding shares with every other node', () => {
    it('renders the stop control while the finding is running', () => {
      const nodes = seed(2);
      store.setState({
        workflowExecutionStates: { [FINDING]: { state: 'running', terminalTabId: 'terminal-1' } },
      });

      const { getByLabelText } = renderNode(nodes[FINDING]);
      expect(getByLabelText('Stop workflow')).toBeInTheDocument();
    });

    it('renders the broken-chain warning alongside the badge', () => {
      const nodes = seed(2);
      nodes[FINDING] = { ...nodes[FINDING], metadata: { ...nodes[FINDING].metadata, brokenChain: true } };
      store.setState({ nodes });

      const { getByLabelText, container } = renderNode(nodes[FINDING]);
      expect(getByLabelText('Session link broken')).toBeInTheDocument();
      expect(container.querySelector('.finding-weight-badge')).not.toBeNull();
    });
  });

  describe('accessibility', () => {
    it('states the weight in an accessible label, so colour is not the only carrier', () => {
      const nodes = seed(4);
      const { getByLabelText } = renderNode(nodes[FINDING]);
      expect(getByLabelText(/weight 4/i)).toBeInTheDocument();
    });

    it('labels a single sighting as well as a repeated one', () => {
      const nodes = seed(1);
      const { getByLabelText } = renderNode(nodes[FINDING]);
      expect(getByLabelText(/weight 1/i)).toBeInTheDocument();
    });
  });

  // Weight 0 is reachable: a hand-typed finding, or one whose back-links were
  // deleted. It reads as the bottom of the muted band rather than as an absent
  // badge, so a finding never falls back to a checkbox it has no status for.
  describe('a finding carrying no back-links', () => {
    it('renders a zero badge rather than a checkbox', () => {
      const nodes = seed(0);
      const { container, queryByLabelText } = renderNode(nodes[FINDING]);
      expect(container.querySelector('.finding-weight-badge')?.textContent).toBe('0');
      expect(queryByLabelText(/^Status:/)).not.toBeInTheDocument();
    });

    it('sits in the muted band', () => {
      const nodes = seed(0);
      const { container } = renderNode(nodes[FINDING]);
      expect(container.querySelector('.finding-weight-badge')?.className).toContain('weight-band-muted');
    });
  });
});
