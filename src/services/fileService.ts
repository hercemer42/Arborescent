import { ArboFile, Node } from '../types';

export async function saveFile(
  filePath: string,
  nodes: Record<string, Node>,
  rootNodeId: string,
  existingMeta?: { created: string; author: string }
): Promise<void> {
  const arboFile: ArboFile = {
    format: 'Arborescent',
    version: '1.0.0',
    created: existingMeta?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    author: existingMeta?.author || 'unknown',
    rootNodeId,
    nodes,
  };

  const json = JSON.stringify(arboFile, null, 2);
  await window.electron.writeFile(filePath, json);
}

export async function loadFile(filePath: string): Promise<ArboFile> {
  const content = await window.electron.readFile(filePath);
  const data = JSON.parse(content) as ArboFile;

  if (data.format !== 'Arborescent') {
    throw new Error('Invalid file format');
  }

  return data;
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
    };
  }
}
