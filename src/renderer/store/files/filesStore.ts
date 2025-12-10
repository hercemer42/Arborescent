import { create } from 'zustand';
import { createFileActions, FileActions } from './actions/fileActions';
import { StorageService } from '@platform';
import { SessionState } from '@shared/interfaces';

export interface ZoomSource {
  sourceFilePath: string;
  zoomedNodeId: string;
}

export interface File {
  path: string;
  displayName: string;
  isTemporary?: boolean;
  zoomSource?: ZoomSource;
}

interface FilesState {
  files: File[];
  activeFilePath: string | null;

  openFile: (path: string, displayName: string, isTemporary?: boolean) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  closeActiveFile: () => void;
  markAsSaved: (oldPath: string, newPath: string, newDisplayName: string) => void;
  openZoomTab: (sourceFilePath: string, nodeId: string, nodeContent: string) => void;
  closeZoomTabsForNode: (nodeId: string) => void;
  getActiveFile: () => File | null;

  actions: FileActions;
}

const storageService = new StorageService();

async function persistSession(files: File[], activeFilePath: string | null): Promise<void> {
  const openFiles = files.map(f => f.path);

  const session: SessionState = {
    openFiles,
    activeFilePath,
  };

  await storageService.saveSession(session);
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  activeFilePath: null,

  openFile: (path: string, displayName: string, isTemporary?: boolean) => {
    const { files } = get();

    if (files.some(f => f.path === path)) {
      set({ activeFilePath: path });
      const newState = get();
      persistSession(newState.files, newState.activeFilePath);
      return;
    }

    set({
      files: [...files, { path, displayName, isTemporary }],
      activeFilePath: path,
    });
    const newState = get();
    persistSession(newState.files, newState.activeFilePath);
  },

  closeFile: (path: string) => {
    const { files, activeFilePath } = get();
    const newFiles = files.filter(f => f.path !== path);

    let newActiveFilePath = activeFilePath;
    if (activeFilePath === path) {
      if (newFiles.length > 0) {
        const closedIndex = files.findIndex(f => f.path === path);
        const newIndex = closedIndex > 0 ? closedIndex - 1 : 0;
        newActiveFilePath = newFiles[newIndex]?.path || null;
      } else {
        newActiveFilePath = null;
      }
    }

    set({
      files: newFiles,
      activeFilePath: newActiveFilePath,
    });
    const newState = get();
    persistSession(newState.files, newState.activeFilePath);
  },

  setActiveFile: (path: string) => {
    set({ activeFilePath: path });
    const newState = get();
    persistSession(newState.files, newState.activeFilePath);
  },

  closeActiveFile: () => {
    const { activeFilePath } = get();
    if (activeFilePath) {
      get().closeFile(activeFilePath);
    }
  },

  markAsSaved: (oldPath: string, newPath: string, newDisplayName: string) => {
    const { files, activeFilePath } = get();
    const newFiles = files.map(f =>
      f.path === oldPath
        ? { path: newPath, displayName: newDisplayName, isTemporary: false }
        : f
    );

    set({
      files: newFiles,
      activeFilePath: activeFilePath === oldPath ? newPath : activeFilePath,
    });
    const newState = get();
    persistSession(newState.files, newState.activeFilePath);
  },

  openZoomTab: (sourceFilePath: string, nodeId: string, nodeContent: string) => {
    const { files } = get();

    const existingZoom = files.find(
      f => f.zoomSource?.sourceFilePath === sourceFilePath && f.zoomSource?.zoomedNodeId === nodeId
    );

    if (existingZoom) {
      set({ activeFilePath: existingZoom.path });
      const newState = get();
      persistSession(newState.files, newState.activeFilePath);
      return;
    }

    const zoomPath = `zoom://${sourceFilePath}#${nodeId}`;
    const displayName = nodeContent.trim() || '(untitled)';
    const truncatedName = displayName.length > 20 ? displayName.slice(0, 20) + '...' : displayName;

    const newZoomTab: File = {
      path: zoomPath,
      displayName: truncatedName,
      zoomSource: { sourceFilePath, zoomedNodeId: nodeId },
    };

    const sourceIndex = files.findIndex(f => f.path === sourceFilePath);
    let insertIndex: number;

    if (sourceIndex === -1) {
      insertIndex = files.length;
    } else {
      insertIndex = sourceIndex + 1;
      while (insertIndex < files.length && files[insertIndex].zoomSource?.sourceFilePath === sourceFilePath) {
        insertIndex++;
      }
    }

    const newFiles = [
      ...files.slice(0, insertIndex),
      newZoomTab,
      ...files.slice(insertIndex),
    ];

    set({
      files: newFiles,
      activeFilePath: zoomPath,
    });
    const newState = get();
    persistSession(newState.files, newState.activeFilePath);
  },

  closeZoomTabsForNode: (nodeId: string) => {
    const { files, activeFilePath } = get();
    const zoomTabsToClose = files.filter(f => f.zoomSource?.zoomedNodeId === nodeId);

    if (zoomTabsToClose.length === 0) return;

    const newFiles = files.filter(f => f.zoomSource?.zoomedNodeId !== nodeId);

    let newActiveFilePath = activeFilePath;
    if (zoomTabsToClose.some(f => f.path === activeFilePath)) {
      if (newFiles.length > 0) {
        const sourceFilePath = zoomTabsToClose.find(f => f.path === activeFilePath)?.zoomSource?.sourceFilePath;
        const sourceFile = sourceFilePath ? newFiles.find(f => f.path === sourceFilePath) : null;
        newActiveFilePath = sourceFile?.path || newFiles[0]?.path || null;
      } else {
        newActiveFilePath = null;
      }
    }

    set({
      files: newFiles,
      activeFilePath: newActiveFilePath,
    });
    const newState = get();
    persistSession(newState.files, newState.activeFilePath);
  },

  getActiveFile: () => {
    const { files, activeFilePath } = get();
    return files.find(f => f.path === activeFilePath) || null;
  },

  actions: createFileActions(get, storageService),
}));
