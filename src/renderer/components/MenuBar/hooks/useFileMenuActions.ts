import { useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';

interface FileMenuActions {
  handleNew: () => Promise<void>;
  handleOpen: () => Promise<void>;
  handleImportBlueprint: () => Promise<void>;
  handleExportBlueprint: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleSaveAs: () => Promise<void>;
  handleCloseTab: () => Promise<void>;
  handleReload: () => void;
  handleQuit: () => void;
}

export function useFileMenuActions(): FileMenuActions {
  const actions = useFilesStore((state) => state.actions);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  const handleNew = useCallback(async () => {
    await actions.createNewFile();
  }, [actions]);

  const handleOpen = useCallback(async () => {
    await actions.openFileWithDialog();
  }, [actions]);

  const handleImportBlueprint = useCallback(async () => {
    await actions.importFromBlueprint();
  }, [actions]);

  const handleExportBlueprint = useCallback(async () => {
    if (activeFilePath) {
      await actions.exportAsBlueprint(activeFilePath);
    }
  }, [actions, activeFilePath]);

  const handleSave = useCallback(async () => {
    await actions.saveActiveFile();
  }, [actions]);

  const handleSaveAs = useCallback(async () => {
    if (activeFilePath) {
      await actions.saveFileAs(activeFilePath);
    }
  }, [actions, activeFilePath]);

  const handleCloseTab = useCallback(async () => {
    if (activeFilePath) {
      await actions.closeFile(activeFilePath);
    }
  }, [actions, activeFilePath]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  const handleQuit = useCallback(() => {
    window.electron.appQuit();
  }, []);

  return {
    handleNew,
    handleOpen,
    handleImportBlueprint,
    handleExportBlueprint,
    handleSave,
    handleSaveAs,
    handleCloseTab,
    handleReload,
    handleQuit,
  };
}
