import { create } from 'zustand';

export interface OpenFile {
  path: string;
  displayName: string;
}

interface TabsState {
  openFiles: OpenFile[];
  activeFilePath: string | null;

  openFile: (path: string, displayName: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  closeActiveFile: () => void;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  openFiles: [],
  activeFilePath: null,

  openFile: (path: string, displayName: string) => {
    const { openFiles } = get();

    // Don't add if already open
    if (openFiles.some(f => f.path === path)) {
      set({ activeFilePath: path });
      return;
    }

    set({
      openFiles: [...openFiles, { path, displayName }],
      activeFilePath: path,
    });
  },

  closeFile: (path: string) => {
    const { openFiles, activeFilePath } = get();
    const newOpenFiles = openFiles.filter(f => f.path !== path);

    // If closing active file, switch to another or null
    let newActiveFilePath = activeFilePath;
    if (activeFilePath === path) {
      if (newOpenFiles.length > 0) {
        // Switch to the file before the closed one, or first file
        const closedIndex = openFiles.findIndex(f => f.path === path);
        const newIndex = closedIndex > 0 ? closedIndex - 1 : 0;
        newActiveFilePath = newOpenFiles[newIndex]?.path || null;
      } else {
        newActiveFilePath = null;
      }
    }

    set({
      openFiles: newOpenFiles,
      activeFilePath: newActiveFilePath,
    });
  },

  setActiveFile: (path: string) => {
    set({ activeFilePath: path });
  },

  closeActiveFile: () => {
    const { activeFilePath } = get();
    if (activeFilePath) {
      get().closeFile(activeFilePath);
    }
  },
}));
