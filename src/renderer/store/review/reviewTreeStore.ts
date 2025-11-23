import { createTreeStore, TreeStore } from '../tree/treeStore';
import type { TreeNode } from '../../../shared/types';

/**
 * Manages review tree stores on a per-file basis
 * Each arbo file can have its own review in progress with its own tree store
 * When switching between files, the review panel shows the review for the active file
 *
 * The review store is a standard TreeStore - it uses the same save mechanism as the workspace.
 * The only difference is the save location (temp file) and context (review panel with accept/cancel).
 */
class ReviewTreeStoreManager {
  private stores = new Map<string, TreeStore>();

  /**
   * Initialize the review store for a specific file with parsed nodes
   */
  initialize(filePath: string, nodes: Record<string, TreeNode>, rootNodeId: string): void {
    if (!this.stores.has(filePath)) {
      this.stores.set(filePath, createTreeStore());
    }

    const store = this.stores.get(filePath)!;
    store.getState().actions.initialize(nodes, rootNodeId);
  }

  /**
   * Set the temp file path for the review store
   * This enables the store's built-in autoSave to persist edits
   */
  setFilePath(filePath: string, tempFilePath: string): void {
    const store = this.stores.get(filePath);
    if (store) {
      store.getState().actions.setFilePath(tempFilePath);
    }
  }

  /**
   * Get the review store for a specific file
   */
  getStoreForFile(filePath: string): TreeStore | null {
    return this.stores.get(filePath) || null;
  }

  /**
   * Clear the review store for a specific file
   */
  clearFile(filePath: string): void {
    this.stores.delete(filePath);
  }

  /**
   * Check if a file has an active review
   */
  hasReview(filePath: string): boolean {
    return this.stores.has(filePath);
  }

  /**
   * Clear all review stores
   */
  clearAll(): void {
    this.stores.clear();
  }
}

export const reviewTreeStore = new ReviewTreeStoreManager();
