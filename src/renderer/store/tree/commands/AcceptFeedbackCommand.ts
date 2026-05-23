import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodesToRegistry, buildAncestorRegistry, AncestorRegistry } from '../../../utils/ancestry';
import { getAllDescendants, captureNodePosition } from '../../../utils/nodeHelpers';
import {
  moveNodeToArchive,
  createArchiveSideLinks,
  createReplacementSideLinks,
  updateRegistryForRelationLinks,
} from './acceptFeedbackArchive';
import {
  type CollaborationSnapshot,
  collectPreservedMetadata,
  executeSingleRootStrategy,
  executeMultiRootStrategy,
} from './acceptFeedbackStrategies';
import { bindSessionInNodes } from '../actions/bindSessionToNode';
import { useTerminalStore } from '../../terminal/terminalStore';
import { v4 as uuidv4 } from 'uuid';

export interface ArchiveConfig {
  archiveDestinationId: string;
  archiveSideLinkName: string;
  replacementSideLinkName: string;
}

export class AcceptFeedbackCommand extends BaseCommand {
  private snapshot: CollaborationSnapshot | null = null;
  private createdNodeIds: string[] = [];
  private relationLinkNodeIds: string[] = [];
  private cachedIdMap: Record<string, string> | null = null;
  private isMultiRoot: boolean;
  private newRootNodeIds: string[];

  constructor(
    private collaboratingNodeId: string,
    newRootNodeIdOrIds: string | string[],
    private newNodesMap: Record<string, TreeNode>,
    private getState: () => {
      nodes: Record<string, TreeNode>;
      rootNodeId: string;
      ancestorRegistry: Record<string, string[]>;
      blueprintModeEnabled: boolean;
      collaboratingNodeId?: string | null;
    },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      rootNodeId?: string;
      ancestorRegistry?: Record<string, string[]>;
      collaboratingNodeId?: string | null;
      collaborationSource?: 'browser' | 'terminal' | null;
      feedbackFadingNodeIds?: Set<string>;
      activeNodeId?: string | null;
    }) => void,
    private triggerAutosave?: () => void,
    private archiveConfig?: ArchiveConfig,
    private precomputedIdMap?: Record<string, string>
  ) {
    super();
    this.newRootNodeIds = Array.isArray(newRootNodeIdOrIds) ? newRootNodeIdOrIds : [newRootNodeIdOrIds];
    this.isMultiRoot = this.newRootNodeIds.length > 1;
    this.description = `Accept feedback for node ${collaboratingNodeId}`;
  }

  private captureSnapshot(
    collaboratingNode: TreeNode,
    state: ReturnType<typeof this.getState>
  ): CollaborationSnapshot {
    const { parentId, originalPosition } = captureNodePosition(this.collaboratingNodeId, state);
    const descendantIds = getAllDescendants(this.collaboratingNodeId, state.nodes);
    const descendants = new Map<string, TreeNode>();
    for (const id of descendantIds) {
      descendants.set(id, { ...state.nodes[id] });
    }

    const parent = state.nodes[parentId];

    const archiveDest = this.archiveConfig ? state.nodes[this.archiveConfig.archiveDestinationId] : null;

    return {
      collaboratingNodeId: this.collaboratingNodeId,
      collaboratingNode: { ...collaboratingNode },
      parentId,
      position: originalPosition,
      descendants,
      wasRootNode: state.rootNodeId === this.collaboratingNodeId,
      parentChildren: parent ? [...parent.children] : [],
      archiveDestinationChildren: archiveDest ? [...archiveDest.children] : undefined,
    };
  }

  private getIdMap(preserveRootId: boolean): Record<string, string> {
    if (this.cachedIdMap) return this.cachedIdMap;

    const idMap: Record<string, string> = this.precomputedIdMap ? { ...this.precomputedIdMap } : {};
    if (preserveRootId) {
      idMap[this.newRootNodeIds[0]] = this.collaboratingNodeId;
    }
    for (const id of Object.keys(this.newNodesMap)) {
      if (!idMap[id]) {
        idMap[id] = uuidv4();
      }
    }
    this.cachedIdMap = idMap;
    return idMap;
  }

  private collaborationClearIfOwned(state: ReturnType<typeof this.getState>): { collaboratingNodeId?: null; collaborationSource?: null } {
    return state.collaboratingNodeId === this.collaboratingNodeId
      ? { collaboratingNodeId: null, collaborationSource: null }
      : {};
  }

  private executeArchive(): void {
    if (!this.archiveConfig || !this.snapshot) return;

    const state = this.getState();
    const { archiveDestinationId, archiveSideLinkName, replacementSideLinkName } = this.archiveConfig;

    if (!state.nodes[archiveDestinationId]) return;

    const updatedNodes = { ...state.nodes };
    let updatedRegistry = { ...state.ancestorRegistry };

    updatedRegistry = moveNodeToArchive(
      updatedNodes,
      updatedRegistry,
      archiveDestinationId,
      this.collaboratingNodeId,
      this.snapshot.collaboratingNode,
      this.snapshot.descendants
    );

    const topLevelReplacementIds = this.createdNodeIds.filter(id => {
      const parentNode = updatedNodes[this.snapshot!.parentId];
      return parentNode?.children.includes(id);
    });

    const archiveCreated = createArchiveSideLinks(
      updatedNodes,
      topLevelReplacementIds,
      archiveSideLinkName,
      this.collaboratingNodeId
    );
    const replacementCreated = createReplacementSideLinks(
      updatedNodes,
      topLevelReplacementIds,
      replacementSideLinkName,
      this.collaboratingNodeId
    );
    this.relationLinkNodeIds.push(...archiveCreated, ...replacementCreated);

    updatedRegistry = updateRegistryForRelationLinks(
      updatedNodes,
      updatedRegistry,
      this.relationLinkNodeIds
    );

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: updatedRegistry,
    });
  }

  execute(): void {
    const state = this.getState();
    const collaboratingNode = state.nodes[this.collaboratingNodeId];
    if (!collaboratingNode) return;

    if (!this.snapshot) {
      this.snapshot = this.captureSnapshot(collaboratingNode, state);
    }
    this.relationLinkNodeIds = [];

    // Multi-root with a non-root collaborator uses the splice-into-parent
    // strategy. Everything else (single-root, or multi-root at tree root)
    // uses in-place replacement (single-root strategy keeps the id).
    const useMultiRootStrategy =
      (this.isMultiRoot || !!this.archiveConfig) && !this.snapshot.wasRootNode;

    const idMap = this.getIdMap(/* preserveRootId */ !useMultiRootStrategy);
    const preservedMetadata = collectPreservedMetadata(collaboratingNode);

    const strategy = useMultiRootStrategy
      ? executeMultiRootStrategy
      : executeSingleRootStrategy;

    const output = strategy({
      state,
      collaboratingNode,
      collaboratingNodeId: this.collaboratingNodeId,
      newRootNodeIds: this.newRootNodeIds,
      newNodesMap: this.newNodesMap,
      idMap,
      preservedMetadata,
      snapshot: this.snapshot,
    });

    this.createdNodeIds = output.createdNodeIds;

    // Multi-root replaces the source node with new outputs; any terminal whose
    // originNodeId pointed at the source needs to migrate to one of the outputs
    // (we pick output.activeNodeId — the first new root), and the source's
    // sessionId follows the terminal there.
    let nodesForState = output.nodes;
    if (useMultiRootStrategy && !this.snapshot.wasRootNode) {
      const sourceSessionId = collaboratingNode.metadata.sessionId;
      if (typeof sourceSessionId === 'string' && sourceSessionId.length > 0) {
        const terminals = useTerminalStore.getState().terminals;
        const matchingTerminals = terminals.filter((t) => t.originNodeId === this.collaboratingNodeId);
        if (matchingTerminals.length > 0) {
          nodesForState = bindSessionInNodes(nodesForState, sourceSessionId, output.activeNodeId);
          const update = useTerminalStore.getState().updateTerminal;
          for (const term of matchingTerminals) {
            update(term.id, { originNodeId: output.activeNodeId });
          }
        }
      }
    }

    this.setState({
      nodes: nodesForState,
      ancestorRegistry: output.ancestorRegistry,
      rootNodeId: state.rootNodeId,
      ...this.collaborationClearIfOwned(state),
      feedbackFadingNodeIds: new Set(this.createdNodeIds),
      activeNodeId: output.activeNodeId,
    });

    if (this.archiveConfig) {
      this.executeArchive();
    }

    this.triggerAutosave?.();
    setTimeout(() => this.setState({ feedbackFadingNodeIds: new Set() }), 1500);
  }

  undo(): void {
    if (!this.snapshot) return;

    const state = this.getState();
    const restoredNodesMap = { ...state.nodes };

    for (const id of this.createdNodeIds) {
      delete restoredNodesMap[id];
    }
    for (const id of this.relationLinkNodeIds) {
      delete restoredNodesMap[id];
    }

    restoredNodesMap[this.snapshot.collaboratingNodeId] = { ...this.snapshot.collaboratingNode };
    this.snapshot.descendants.forEach((node, nodeId) => {
      restoredNodesMap[nodeId] = { ...node };
    });

    if ((this.isMultiRoot || this.archiveConfig) && !this.snapshot.wasRootNode) {
      const parentNode = restoredNodesMap[this.snapshot.parentId];
      if (parentNode) {
        restoredNodesMap[this.snapshot.parentId] = {
          ...parentNode,
          children: [...this.snapshot.parentChildren],
        };
      }
    }

    if (this.archiveConfig && this.snapshot.archiveDestinationChildren) {
      const archiveDest = restoredNodesMap[this.archiveConfig.archiveDestinationId];
      if (archiveDest) {
        restoredNodesMap[this.archiveConfig.archiveDestinationId] = {
          ...archiveDest,
          children: [...this.snapshot.archiveDestinationChildren],
        };
      }
    }

    let newAncestorRegistry: AncestorRegistry;
    if (this.snapshot.wasRootNode) {
      newAncestorRegistry = buildAncestorRegistry(this.snapshot.collaboratingNodeId, restoredNodesMap);
    } else {
      const registry = { ...state.ancestorRegistry };
      for (const id of this.createdNodeIds) {
        delete registry[id];
      }
      for (const id of this.relationLinkNodeIds) {
        delete registry[id];
      }
      newAncestorRegistry = addNodesToRegistry(registry, [this.collaboratingNodeId], this.snapshot.parentId, restoredNodesMap);
    }

    this.setState({
      nodes: restoredNodesMap,
      ancestorRegistry: newAncestorRegistry,
      rootNodeId: state.rootNodeId,
      ...this.collaborationClearIfOwned(state),
      feedbackFadingNodeIds: new Set(),
      activeNodeId: this.snapshot.collaboratingNodeId,
    });

    this.triggerAutosave?.();
  }
}
