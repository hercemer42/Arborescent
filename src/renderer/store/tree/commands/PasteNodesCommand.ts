import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { buildAncestorRegistry } from '../../../utils/ancestry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Command for pasting nodes from clipboard (with hierarchy preservation)
 */
export class PasteNodesCommand extends BaseCommand {
  private pastedNodeIds: string[] = [];
  private remappedNodes: Record<string, TreeNode> = {};
  private rootNodeIds: string[] = [];

  constructor(
    private parsedRootNodes: TreeNode[],
    private parsedAllNodes: Record<string, TreeNode>,
    private targetParentId: string,
    private getState: () => { nodes: Record<string, TreeNode>; rootNodeId: string },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
    }) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Paste ${parsedRootNodes.length} node(s)`;
    this.prepareNodes();
  }

  /**
   * Re-generate IDs for all pasted nodes to avoid conflicts
   */
  private prepareNodes(): void {
    const idMapping: Record<string, string> = {};

    // First pass: create new IDs for all nodes
    for (const oldId of Object.keys(this.parsedAllNodes)) {
      const newId = uuidv4();
      idMapping[oldId] = newId;
      this.pastedNodeIds.push(newId);
    }

    // Second pass: remap all node references
    for (const [oldId, node] of Object.entries(this.parsedAllNodes)) {
      const newId = idMapping[oldId];
      this.remappedNodes[newId] = {
        ...node,
        id: newId,
        children: node.children.map((childId) => idMapping[childId] || childId),
      };
    }

    // Get root node IDs with new mapping
    this.rootNodeIds = this.parsedRootNodes.map((node) => idMapping[node.id]);
  }

  execute(): void {
    const { nodes, rootNodeId } = this.getState();
    const parent = nodes[this.targetParentId];
    if (!parent) return;

    // Add all remapped nodes to the tree
    const updatedNodes = { ...nodes, ...this.remappedNodes };

    // Add root nodes as children of the target parent
    const updatedChildren = [...parent.children, ...this.rootNodeIds];

    updatedNodes[this.targetParentId] = {
      ...parent,
      children: updatedChildren,
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    // Select the first pasted root node
    const firstPastedId = this.rootNodeIds[0];

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: firstPastedId,
      cursorPosition: 0,
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const { nodes, rootNodeId } = this.getState();
    const parent = nodes[this.targetParentId];
    if (!parent) return;

    // Remove all pasted nodes
    const updatedNodes = { ...nodes };
    for (const nodeId of this.pastedNodeIds) {
      delete updatedNodes[nodeId];
    }

    // Remove root nodes from parent's children
    const updatedChildren = parent.children.filter(
      (id) => !this.rootNodeIds.includes(id)
    );

    updatedNodes[this.targetParentId] = {
      ...parent,
      children: updatedChildren,
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.targetParentId,
      cursorPosition: updatedNodes[this.targetParentId].content.length,
    });

    this.triggerAutosave?.();
  }

  /**
   * Get the IDs of the root nodes that were pasted (for flashing)
   */
  getPastedRootIds(): string[] {
    return this.rootNodeIds;
  }
}
