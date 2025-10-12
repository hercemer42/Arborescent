import { ArboFile, TreeNode, NodeTypeConfig } from '../../shared/types';
import { ElectronStorageService, createArboFile } from '@platform/storage';

const storageService = new ElectronStorageService();

export async function saveFile(
  filePath: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  nodeTypeConfig: Record<string, NodeTypeConfig>,
  existingMeta?: { created: string; author: string }
): Promise<void> {
  const arboFile = createArboFile(nodes, rootNodeId, nodeTypeConfig, existingMeta);
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
