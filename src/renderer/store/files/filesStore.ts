import { create } from 'zustand';
import { createFileActions, FileActions } from './actions/fileActions';
import { StorageService } from '@platform';
import { SessionState } from '@shared/interfaces';

export interface File {
  path: string;
  displayName: string;
  isTemporary?: boolean;
}

interface FilesState {
  files: File[];
  activeFilePath: string | null;

  openFile: (path: string, displayName: string, isTemporary?: boolean) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  closeActiveFile: () => void;
  markAsSaved: (oldPath: string, newPath: string, newDisplayName: string) => void;

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

  actions: createFileActions(get, storageService),
}));
