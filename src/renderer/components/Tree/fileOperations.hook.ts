import { useState, useEffect } from 'react';
import { saveFile, loadFile } from '../../services/fileService';
import { useTreeStore } from '../../store/treeStore';
import { defaultNodeTypeConfig } from '../../data/defaultTemplate';

export function useFileOperations() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ created: string; author: string } | null>(null);

  const nodes = useTreeStore((state) => state.nodes);
  const rootNodeId = useTreeStore((state) => state.rootNodeId);
  const nodeTypeConfig = useTreeStore((state) => state.nodeTypeConfig);
  const initialize = useTreeStore((state) => state.initialize);

  const handleLoad = async () => {
    try {
      const path = await window.electron.showOpenDialog();
      if (!path) return;

      const data = await loadFile(path);
      const configToUse = (data.nodeTypeConfig && Object.keys(data.nodeTypeConfig).length > 0)
        ? data.nodeTypeConfig
        : defaultNodeTypeConfig;
      initialize(data.nodes, data.rootNodeId, configToUse);
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

      await saveFile(path, nodes, rootNodeId, nodeTypeConfig, fileMeta || undefined);
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

      await saveFile(path, nodes, rootNodeId, nodeTypeConfig, fileMeta || undefined);
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
  }, [nodes, filePath, fileMeta, rootNodeId, nodeTypeConfig]);
}
