import { createTreeStore, TreeStore } from '../tree/treeStore';
import type { TreeNode } from '../../../shared/types';

class FeedbackTreeStoreManager {
  private stores = new Map<string, TreeStore>();
  private version = 0;
  private versionListeners = new Set<() => void>();

  initialize(filePath: string, nodes: Record<string, TreeNode>, rootNodeId: string): void {
    if (!this.stores.has(filePath)) {
      this.stores.set(filePath, createTreeStore('feedback'));
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

  setFilePath(filePath: string, tempFilePath: string): void {
    const store = this.stores.get(filePath);
    if (store) {
      store.getState().actions.setFilePath(tempFilePath);
    }
  }

  getStoreForFile(filePath: string): TreeStore | null {
    return this.stores.get(filePath) || null;
  }

  clearFile(filePath: string): void {
    this.stores.delete(filePath);
  }

  hasFeedback(filePath: string): boolean {
    return this.stores.has(filePath);
  }

  clearAll(): void {
    this.stores.clear();
  }
}

export const feedbackTreeStore = new FeedbackTreeStoreManager();
