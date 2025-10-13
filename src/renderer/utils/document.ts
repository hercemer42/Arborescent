import { ArboFile, TreeNode, NodeTypeConfig } from '../../shared/types';

export function createArboFile(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  nodeTypeConfig: Record<string, NodeTypeConfig>,
  existingMeta?: { created: string; author: string }
): ArboFile {
  return {
    format: 'Arborescent',
    version: '1.0.0',
    created: existingMeta?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    author: existingMeta?.author || 'unknown',
    rootNodeId,
    nodes,
    nodeTypeConfig,
  };
}
