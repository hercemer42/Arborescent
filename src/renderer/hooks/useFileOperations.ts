import { useState, useEffect } from 'react';
import { Node } from '../../shared/types';
import { saveFile, loadFile } from '../services/fileService';

export function useFileOperations(
  initialNodes: Record<string, Node>,
  initialRootNodeId: string
) {
  const [nodes, setNodes] = useState(initialNodes);
  const [rootNodeId, setRootNodeId] = useState(initialRootNodeId);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ created: string; author: string } | null>(null);

  const handleLoad = async () => {
    try {
      const path = await window.electron.showOpenDialog();
      if (!path) return;

      const data = await loadFile(path);
      setNodes(data.nodes);
      setRootNodeId(data.rootNodeId);
      setFilePath(path);
      setFileMeta({ created: data.created, author: data.author });
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

  const handleSave = async () => {
    try {
      const path = filePath || (await window.electron.showSaveDialog());
      if (!path) return;

      await saveFile(path, nodes, rootNodeId, fileMeta || undefined);
      setFilePath(path);
      console.log('File saved:', path);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const handleSaveAs = async () => {
    try {
      const path = await window.electron.showSaveDialog();
      if (!path) return;

      await saveFile(path, nodes, rootNodeId, fileMeta || undefined);
      setFilePath(path);
      console.log('File saved:', path);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  useEffect(() => {
    window.electron.onMenuOpen(handleLoad);
    window.electron.onMenuSave(handleSave);
    window.electron.onMenuSaveAs(handleSaveAs);
  }, [nodes, filePath, fileMeta, rootNodeId]);

  return {
    nodes,
    setNodes,
    rootNodeId,
    filePath,
  };
}
