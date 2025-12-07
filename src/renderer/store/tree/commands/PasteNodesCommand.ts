import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { getIsContextChild } from '../../../utils/nodeHelpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Command for pasting nodes from clipboard (with hierarchy preservation)
 */
export class PasteNodesCommand extends BaseCommand {
  private pastedNodeIds: string[] = [];
  private remappedNodes: Record<string, TreeNode> = {};
  private rootNodeIds: string[] = [];

  /**
   * @param parsedRootNodes - The root nodes to paste
   * @param parsedAllNodes - All nodes (roots + descendants) keyed by their ID
   * @param targetParentId - The parent node to paste into
   * @param getState - State getter
   * @param setState - State setter
   * @param triggerAutosave - Optional autosave callback
   * @param skipPrepare - If true, nodes already have unique IDs and correct structure
   */
  constructor(
    private parsedRootNodes: TreeNode[],
    private parsedAllNodes: Record<string, TreeNode>,
    private targetParentId: string,
    private getState: () => { nodes: Record<string, TreeNode>; rootNodeId: string; ancestorRegistry: AncestorRegistry },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
    }) => void,
    private triggerAutosave?: () => void,
    skipPrepare: boolean = false
  ) {
    super();
    this.description = `Paste ${parsedRootNodes.length} node(s)`;
    if (skipPrepare) {
      // Nodes already have unique IDs - use directly
      this.remappedNodes = parsedAllNodes;
      this.pastedNodeIds = Object.keys(parsedAllNodes);
      this.rootNodeIds = parsedRootNodes.map((n) => n.id);
    } else {
      // Nodes from markdown need ID remapping
      this.prepareNodes();
    }
  }

  /**
   * Re-generate IDs for all pasted nodes to avoid conflicts.
   * Used when pasting from external markdown where IDs may conflict.
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
    const { nodes, ancestorRegistry } = this.getState();
    const parent = nodes[this.targetParentId];
    if (!parent) return;

    // Check if pasting into a context tree
    const parentIsContextDeclaration = parent.metadata.isContextDeclaration === true;
    const parentIsContextChild = getIsContextChild(this.targetParentId, nodes, ancestorRegistry);
    const parentIsContextTree = parentIsContextDeclaration || parentIsContextChild;

    // Process pasted nodes: clear context declaration metadata, inherit blueprint if in context tree
    const processedNodes = this.processNodesForPaste(this.remappedNodes, parentIsContextTree);

    // Add all processed nodes to the tree
    const updatedNodes = { ...nodes, ...processedNodes };

    // Add root nodes as children of the target parent
    const updatedChildren = [...parent.children, ...this.rootNodeIds];

    updatedNodes[this.targetParentId] = {
      ...parent,
      children: updatedChildren,
    };

    // Incremental update: add pasted nodes to registry
    const newAncestorRegistry = addNodesToRegistry(
      ancestorRegistry,
      this.rootNodeIds,
      this.targetParentId,
      updatedNodes
    );

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

  /**
   * Process nodes for pasting: clear context declaration metadata.
   * Context declaration metadata is always cleared (can't paste a context into another tree).
   * If pasting into a context tree, set isBlueprint: true on all pasted nodes.
   */
  private processNodesForPaste(
    nodesToUpdate: Record<string, TreeNode>,
    parentIsContextTree: boolean
  ): Record<string, TreeNode> {
    const result: Record<string, TreeNode> = {};

    for (const [nodeId, node] of Object.entries(nodesToUpdate)) {
      const wasContextDeclaration = node.metadata.isContextDeclaration === true;

      result[nodeId] = {
        ...node,
        metadata: {
          ...node.metadata,
          // Clear context declaration metadata (can't paste context declarations)
          isContextDeclaration: undefined,
          // Only clear blueprint icon/color if this was a context declaration
          // (regular blueprints keep their icon)
          blueprintIcon: wasContextDeclaration ? undefined : node.metadata.blueprintIcon,
          blueprintColor: wasContextDeclaration ? undefined : node.metadata.blueprintColor,
          // Inherit blueprint status when pasting into a context tree
          isBlueprint: parentIsContextTree ? true : node.metadata.isBlueprint,
        },
      };
    }

    return result;
  }

  undo(): void {
    const { nodes, ancestorRegistry } = this.getState();
    const parent = nodes[this.targetParentId];
    if (!parent) return;

    // Incremental update: remove pasted nodes from registry
    // We need to remove each root node and its descendants
    let newAncestorRegistry = ancestorRegistry;
    for (const rootId of this.rootNodeIds) {
      newAncestorRegistry = removeNodeFromRegistry(newAncestorRegistry, rootId, this.remappedNodes);
    }

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
