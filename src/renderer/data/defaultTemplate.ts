import { NodeTypeConfig, TreeNode } from '../../shared/types';

export const defaultNodeTypeConfig: Record<string, NodeTypeConfig> = {
  project: {
    icon: '📁',
    style: '',
  },
  section: {
    icon: '📂',
    style: '',
  },
  task: {
    icon: '',
    style: '',
  },
  doc: {
    icon: '📄',
    style: '',
  },
};

export function createBlankDocument(): {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  nodeTypeConfig: Record<string, NodeTypeConfig>;
  firstNodeId: string;
} {
  const rootId = 'root';
  const firstNodeId = 'node-1';

  return {
    nodes: {
      [rootId]: {
        id: rootId,
        type: 'project',
        content: '',
        children: [firstNodeId],
        metadata: {},
      },
      [firstNodeId]: {
        id: firstNodeId,
        type: 'project',
        content: '',
        children: [],
        metadata: {},
      },
    },
    rootNodeId: rootId,
    firstNodeId,
    nodeTypeConfig: defaultNodeTypeConfig,
  };
}
