import { createTreeStore, TreeStore } from '../tree/treeStore';

/**
 * Dedicated tree store for review content
 * This is a singleton store used to display and edit the reviewed tree structure
 * Separate from the main file stores managed by storeManager
 */
class ReviewTreeStoreManager {
  private store: TreeStore | null = null;

  /**
   * Initialize the review store with parsed nodes
   */
  initialize(nodes: Record<string, import('../../../shared/types').TreeNode>, rootNodeId: string): void {
    if (!this.store) {
      this.store = createTreeStore();
    }

    const state = this.store.getState();
    state.actions.initialize(nodes, rootNodeId);
  }

  /**
   * Get the current review store
   */
  getStore(): TreeStore | null {
    return this.store;
  }

  /**
   * Clear the review store
   */
  clear(): void {
    this.store = null;
  }

  /**
   * Check if review store is initialized
   */
  isInitialized(): boolean {
    return this.store !== null;
  }
}

export const reviewTreeStore = new ReviewTreeStoreManager();
