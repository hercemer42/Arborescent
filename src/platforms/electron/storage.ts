import { ArboFile, TreeNode, NodeTypeConfig } from '../../shared/types';
import { StorageService } from '../../renderer/services/interfaces';

export class ElectronStorageService implements StorageService {
  async loadDocument(filePath: string): Promise<ArboFile> {
    const content = await window.electron.readFile(filePath);
    const data = JSON.parse(content) as ArboFile;

    if (data.format !== 'Arborescent') {
      throw new Error('Invalid file format');
    }

    return data;
  }

  async saveDocument(filePath: string, data: ArboFile): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await window.electron.writeFile(filePath, json);
  }

  async showOpenDialog(): Promise<string | null> {
    return window.electron.showOpenDialog();
  }

  async showSaveDialog(): Promise<string | null> {
    return window.electron.showSaveDialog();
  }
}

export function createArboFile(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  nodeTypeConfig: Record<string, NodeTypeConfig>,
  existingMeta?: { created: string; author: string }
): ArboFile {
  return {
    format: 'Arborescent',
    version: '1.0.0',
    created: existingMeta?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    author: existingMeta?.author || 'unknown',
    rootNodeId,
    nodes,
    nodeTypeConfig,
  };
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
