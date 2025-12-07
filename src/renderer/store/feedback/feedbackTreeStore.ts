import { createTreeStore, TreeStore } from '../tree/treeStore';
import type { TreeNode } from '../../../shared/types';

/**
 * Manages feedback tree stores on a per-file basis
 * Each arbo file can have its own collaboration in progress with its own tree store
 * When switching between files, the feedback panel shows the feedback for the active file
 *
 * The feedback store is a standard TreeStore - it uses the same save mechanism as the workspace.
 * The only difference is the save location (temp file) and context (feedback panel with accept/cancel).
 */
class FeedbackTreeStoreManager {
  private stores = new Map<string, TreeStore>();
  private version = 0;
  private versionListeners = new Set<() => void>();

  /**
   * Initialize the feedback store for a specific file with parsed nodes
   */
  initialize(filePath: string, nodes: Record<string, TreeNode>, rootNodeId: string): void {
    if (!this.stores.has(filePath)) {
      this.stores.set(filePath, createTreeStore('feedback'));
    }

    const store = this.stores.get(filePath)!;
    store.getState().actions.initialize(nodes, rootNodeId);

    this.version++;
    this.versionListeners.forEach(listener => listener());
  }

  /**
   * Subscribe to version changes
   */
  subscribeToVersion(listener: () => void): () => void {
    this.versionListeners.add(listener);
    return () => this.versionListeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  /**
   * Set the temp file path for the feedback store
   * This enables the store's built-in autoSave to persist edits
   */
  setFilePath(filePath: string, tempFilePath: string): void {
    const store = this.stores.get(filePath);
    if (store) {
      store.getState().actions.setFilePath(tempFilePath);
    }
  }

  /**
   * Get the feedback store for a specific file
   */
  getStoreForFile(filePath: string): TreeStore | null {
    return this.stores.get(filePath) || null;
  }

  /**
   * Clear the feedback store for a specific file
   */
  clearFile(filePath: string): void {
    this.stores.delete(filePath);
  }

  /**
   * Check if a file has active feedback
   */
  hasFeedback(filePath: string): boolean {
    return this.stores.has(filePath);
  }

  /**
   * Clear all feedback stores
   */
  clearAll(): void {
    this.stores.clear();
  }
}

export const feedbackTreeStore = new FeedbackTreeStoreManager();
