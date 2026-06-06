import type { TreeStore } from '../tree/treeStore';
import type { TreeNode } from '../../../shared/types';

type FeedbackStoreFactory = () => TreeStore;

class FeedbackTreeStoreManager {
  private stores = new Map<string, TreeStore>();
  private version = 0;
  private versionListeners = new Set<() => void>();
  private storeFactory: FeedbackStoreFactory | null = null;

  setStoreFactory(factory: FeedbackStoreFactory): void {
    this.storeFactory = factory;
  }

  initialize(filePath: string, nodes: Record<string, TreeNode>, rootNodeId: string): void {
    if (!this.stores.has(filePath)) {
      if (!this.storeFactory) {
        throw new Error('Feedback store factory used before storeManager wired it');
      }
      this.stores.set(filePath, this.storeFactory());
    }

    const store = this.stores.get(filePath)!;
    store.getState().actions.initialize(nodes, rootNodeId);

    this.version++;
    this.versionListeners.forEach(listener => listener());
  }

  subscribeToVersion(listener: () => void): () => void {
    this.versionListeners.add(listener);
    return () => this.versionListeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  getStoreForFile(filePath: string): TreeStore | null {
    return this.stores.get(filePath) || null;
  }

  clearFile(filePath: string): void {
    this.stores.delete(filePath);
    this.version++;
    this.versionListeners.forEach(listener => listener());
  }

  hasFeedback(filePath: string): boolean {
    return this.stores.has(filePath);
  }

  clearAll(): void {
    this.stores.clear();
  }
}

export const feedbackTreeStore = new FeedbackTreeStoreManager();
