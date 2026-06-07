import type { TreeStore } from '../tree/treeStore';
import type { TreeNode } from '../../../shared/types';

type FeedbackStoreFactory = () => TreeStore;

interface FeedbackStoreEntry {
  filePath: string;
  store: TreeStore;
}

// Keyed per reviewed node so concurrent reviews — including several in the same file — each get
// an independent editable proposition store. Each entry tracks its file so closing a file can
// drop all of its reviews' stores in one pass.
class FeedbackTreeStoreManager {
  private stores = new Map<string, FeedbackStoreEntry>();
  private version = 0;
  private versionListeners = new Set<() => void>();
  private storeFactory: FeedbackStoreFactory | null = null;

  setStoreFactory(factory: FeedbackStoreFactory): void {
    this.storeFactory = factory;
  }

  initialize(reviewedNodeId: string, filePath: string, nodes: Record<string, TreeNode>, rootNodeId: string): void {
    let entry = this.stores.get(reviewedNodeId);
    if (!entry) {
      if (!this.storeFactory) {
        throw new Error('Feedback store factory used before storeManager wired it');
      }
      entry = { filePath, store: this.storeFactory() };
      this.stores.set(reviewedNodeId, entry);
    }

    entry.store.getState().actions.initialize(nodes, rootNodeId);
    this.bumpVersion();
  }

  subscribeToVersion(listener: () => void): () => void {
    this.versionListeners.add(listener);
    return () => this.versionListeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  getStoreForNode(reviewedNodeId: string): TreeStore | null {
    return this.stores.get(reviewedNodeId)?.store ?? null;
  }

  hasFeedbackForNode(reviewedNodeId: string): boolean {
    return this.stores.has(reviewedNodeId);
  }

  clearForNode(reviewedNodeId: string): void {
    if (this.stores.delete(reviewedNodeId)) this.bumpVersion();
  }

  clearForFile(filePath: string): void {
    let changed = false;
    for (const [nodeId, entry] of this.stores) {
      if (entry.filePath === filePath) {
        this.stores.delete(nodeId);
        changed = true;
      }
    }
    if (changed) this.bumpVersion();
  }

  clearAll(): void {
    this.stores.clear();
  }

  private bumpVersion(): void {
    this.version++;
    this.versionListeners.forEach(listener => listener());
  }
}

export const feedbackTreeStore = new FeedbackTreeStoreManager();
