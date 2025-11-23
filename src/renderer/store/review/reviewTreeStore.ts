import { createTreeStore, TreeStore } from '../tree/treeStore';
import type { TreeNode } from '../../../shared/types';
import { exportNodeAsMarkdown } from '../../utils/markdown';
import { logger } from '../../services/logger';

interface ReviewStoreEntry {
  store: TreeStore;
  tempFilePath: string | null;
  reviewingNodeId: string | null;
  unsubscribe: (() => void) | null;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Manages review tree stores on a per-file basis
 * Each arbo file can have its own review in progress with its own tree store
 * When switching between files, the review panel shows the review for the active file
 */
class ReviewTreeStoreManager {
  private stores = new Map<string, ReviewStoreEntry>();

  /**
   * Initialize the review store for a specific file with parsed nodes
   */
  initialize(filePath: string, nodes: Record<string, TreeNode>, rootNodeId: string): void {
    if (!this.stores.has(filePath)) {
      const store = createTreeStore();
      this.stores.set(filePath, {
        store,
        tempFilePath: null,
        reviewingNodeId: null,
        unsubscribe: null,
      });
    }

    const entry = this.stores.get(filePath)!;
    entry.store.getState().actions.initialize(nodes, rootNodeId);
  }

  /**
   * Set the temp file path for auto-saving review edits
   */
  setTempFilePath(filePath: string, tempFilePath: string, reviewingNodeId: string): void {
    const entry = this.stores.get(filePath);
    if (entry) {
      entry.tempFilePath = tempFilePath;
      entry.reviewingNodeId = reviewingNodeId;

      // Subscribe to store changes for auto-save
      if (entry.unsubscribe) {
        entry.unsubscribe();
      }
      entry.unsubscribe = entry.store.subscribe(() => {
        this.debouncedSave(filePath);
      });
    }
  }

  /**
   * Debounced save to temp file
   */
  private debouncedSave(filePath: string): void {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      await this.saveToTempFile(filePath);
      saveTimeout = null;
    }, 2000);
  }

  /**
   * Save current review content to temp file
   * Overwrites the existing temp file directly (doesn't create new files)
   */
  async saveToTempFile(filePath: string): Promise<void> {
    const entry = this.stores.get(filePath);
    if (!entry || !entry.tempFilePath || !entry.reviewingNodeId) {
      return;
    }

    const { nodes, rootNodeId } = entry.store.getState();
    const hiddenRoot = nodes[rootNodeId];
    if (!hiddenRoot || hiddenRoot.children.length === 0) {
      return;
    }

    // Get actual content root (first child of hidden root)
    const actualRootId = hiddenRoot.children[0];
    const actualRoot = nodes[actualRootId];
    if (!actualRoot) {
      return;
    }

    // Export as markdown
    const markdown = exportNodeAsMarkdown(actualRoot, nodes);

    try {
      // Directly overwrite the existing temp file (don't create new files with different hashes)
      await window.electron.writeFile(entry.tempFilePath, markdown);
      logger.info('Auto-saved review edits to temp file', 'ReviewTreeStore');
    } catch (error) {
      logger.error('Failed to auto-save review edits', error as Error, 'ReviewTreeStore');
    }
  }

  /**
   * Get the review store for a specific file
   */
  getStoreForFile(filePath: string): TreeStore | null {
    const entry = this.stores.get(filePath);
    return entry ? entry.store : null;
  }

  /**
   * Clear the review store for a specific file
   */
  clearFile(filePath: string): void {
    const entry = this.stores.get(filePath);
    if (entry?.unsubscribe) {
      entry.unsubscribe();
    }
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
    // Unsubscribe from all stores
    for (const entry of this.stores.values()) {
      if (entry.unsubscribe) {
        entry.unsubscribe();
      }
    }
    this.stores.clear();
  }
}

export const reviewTreeStore = new ReviewTreeStoreManager();
