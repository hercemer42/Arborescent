import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { getIsContextChild } from '../../../utils/nodeHelpers';
import { v4 as uuidv4 } from 'uuid';

export class PasteNodesCommand extends BaseCommand {
  private pastedNodeIds: string[] = [];
  private remappedNodes: Record<string, TreeNode> = {};
  private rootNodeIds: string[] = [];

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
      this.remappedNodes = parsedAllNodes;
      this.pastedNodeIds = Object.keys(parsedAllNodes);
      this.rootNodeIds = parsedRootNodes.map((n) => n.id);
    } else {
      this.prepareNodes();
    }
  }

  private prepareNodes(): void {
    const idMapping: Record<string, string> = {};

    for (const oldId of Object.keys(this.parsedAllNodes)) {
      const newId = uuidv4();
      idMapping[oldId] = newId;
      this.pastedNodeIds.push(newId);
    }

    for (const [oldId, node] of Object.entries(this.parsedAllNodes)) {
      const newId = idMapping[oldId];
      this.remappedNodes[newId] = {
        ...node,
        id: newId,
        children: node.children.map((childId) => idMapping[childId] || childId),
      };
    }

    this.rootNodeIds = this.parsedRootNodes.map((node) => idMapping[node.id]);
  }

  execute(): void {
    const { nodes, ancestorRegistry } = this.getState();
    const parent = nodes[this.targetParentId];
    if (!parent) return;

    const parentIsContextDeclaration = parent.metadata.isContextDeclaration === true;
    const parentIsContextChild = getIsContextChild(this.targetParentId, nodes, ancestorRegistry);
    const parentIsContextTree = parentIsContextDeclaration || parentIsContextChild;

    const processedNodes = this.processNodesForPaste(this.remappedNodes, parentIsContextTree);
    const updatedNodes = { ...nodes, ...processedNodes };
    const updatedChildren = [...parent.children, ...this.rootNodeIds];

    updatedNodes[this.targetParentId] = {
      ...parent,
      children: updatedChildren,
    };

    const newAncestorRegistry = addNodesToRegistry(
      ancestorRegistry,
      this.rootNodeIds,
      this.targetParentId,
      updatedNodes
    );

    const firstPastedId = this.rootNodeIds[0];

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: firstPastedId,
      cursorPosition: 0,
    });

    this.triggerAutosave?.();
  }

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
          isContextDeclaration: undefined,
          blueprintIcon: wasContextDeclaration ? undefined : node.metadata.blueprintIcon,
          blueprintColor: wasContextDeclaration ? undefined : node.metadata.blueprintColor,
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

    let newAncestorRegistry = ancestorRegistry;
    for (const rootId of this.rootNodeIds) {
      newAncestorRegistry = removeNodeFromRegistry(newAncestorRegistry, rootId, this.remappedNodes);
    }

    const updatedNodes = { ...nodes };
    for (const nodeId of this.pastedNodeIds) {
      delete updatedNodes[nodeId];
    }

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

  getPastedRootIds(): string[] {
    return this.rootNodeIds;
  }
}
