import { createTreeStore, TreeStore } from './tree/treeStore';

function parseZoomPath(filePath: string): { sourceFilePath: string; nodeId: string } | null {
  if (!filePath.startsWith('zoom://')) return null;
  const withoutPrefix = filePath.slice('zoom://'.length);
  const hashIndex = withoutPrefix.lastIndexOf('#');
  if (hashIndex === -1) return null;
  return {
    sourceFilePath: withoutPrefix.slice(0, hashIndex),
    nodeId: withoutPrefix.slice(hashIndex + 1),
  };
}

class StoreManager {
  private stores = new Map<string, TreeStore>();

  getStoreForFile(filePath: string): TreeStore {
    // For zoom tabs, return the store for the source file
    const zoomInfo = parseZoomPath(filePath);
    const actualPath = zoomInfo ? zoomInfo.sourceFilePath : filePath;

    if (!this.stores.has(actualPath)) {
      this.stores.set(actualPath, createTreeStore());
    }
    return this.stores.get(actualPath)!;
  }

  getZoomInfo(filePath: string): { sourceFilePath: string; nodeId: string } | null {
    return parseZoomPath(filePath);
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
