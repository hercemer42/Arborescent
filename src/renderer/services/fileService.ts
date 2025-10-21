import { ArboFile, TreeNode } from '../../shared/types';
import { ElectronStorageService } from '@platform/storage';
import { createArboFile } from '../utils/document';

const storageService = new ElectronStorageService();

export async function saveFile(
  filePath: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  existingMeta?: { created: string; author: string }
): Promise<void> {
  const arboFile = createArboFile(nodes, rootNodeId, existingMeta);
  await storageService.saveDocument(filePath, arboFile);
}

export async function loadFile(filePath: string): Promise<ArboFile> {
  return storageService.loadDocument(filePath);
}

declare global {
  interface Window {
    electron: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      showOpenDialog: () => Promise<string | null>;
      showSaveDialog: () => Promise<string | null>;
      onMenuOpen: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
      onMainError: (callback: (message: string) => void) => void;
    };
  }
}
