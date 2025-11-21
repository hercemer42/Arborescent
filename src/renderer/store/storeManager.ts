import { createTreeStore, TreeStore } from './tree/treeStore';

class StoreManager {
  private stores = new Map<string, TreeStore>();

  getStoreForFile(filePath: string): TreeStore {
    if (!this.stores.has(filePath)) {
      this.stores.set(filePath, createTreeStore());
    }
    return this.stores.get(filePath)!;
  }

  async closeFile(filePath: string): Promise<void> {
    const store = this.stores.get(filePath);
    if (!store) return;

    const { currentFilePath, fileMeta, actions } = store.getState();
    if (currentFilePath) {
      try {
        await actions.saveToPath(currentFilePath, fileMeta || undefined);
      } catch (error) {
        console.error(`Failed to save file before closing: ${error}`);
      }
    }

    this.stores.delete(filePath);
  }

  moveStore(oldPath: string, newPath: string): void {
    const store = this.stores.get(oldPath);
    if (store) {
      this.stores.set(newPath, store);
      this.stores.delete(oldPath);
    }
  }

  hasStore(filePath: string): boolean {
    return this.stores.has(filePath);
  }

  clearAll(): void {
    this.stores.clear();
  }
}

export const storeManager = new StoreManager();
