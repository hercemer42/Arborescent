import type { TreeStore } from './tree/treeStore';

export interface StoreAccess {
  getStoreForFile(filePath: string): TreeStore;
  getAllStores(): TreeStore[];
  getAllStoreEntries(): Array<{ filePath: string; store: TreeStore }>;
  moveStore(oldPath: string, newPath: string): void;
  closeFile(filePath: string): Promise<void>;
  hasStore(filePath: string): boolean;
}
