import { create } from 'zustand';
import { createFileActions, FileActions } from './actions/fileActions';
import { StorageService } from '../../services/storageService';
import type { StoreAccess } from '../storeAccess';
import { SessionState } from '@shared/interfaces';

let injectedStoreAccess: StoreAccess | null = null;

export function setFileActionsStoreAccess(access: StoreAccess): void {
  injectedStoreAccess = access;
}

function requireStoreAccess(): StoreAccess {
  if (!injectedStoreAccess) {
    throw new Error('File actions store access used before storeManager wired it');
  }
  return injectedStoreAccess;
}

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

export interface OpenZoomTabOptions {
  background?: boolean;
}

interface FilesState {
  files: File[];
  activeFilePath: string | null;
  // Zoomed review nodes whose tab should show the "review feedback pending" highlight. Transient
  // (never persisted) so a reload cannot strand a highlight; entries are added when a background
  // review zoom opens and removed once that tab is focused or its review is resolved/closed.
  reviewPendingNodeIds: Set<string>;

  openFile: (path: string, displayName: string, isTemporary?: boolean) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  closeActiveFile: () => void;
  markAsSaved: (oldPath: string, newPath: string, newDisplayName: string) => void;
  openZoomTab: (sourceFilePath: string, nodeId: string, nodeContent: string, options?: OpenZoomTabOptions) => void;
  closeZoomTabsForNode: (nodeId: string) => void;
  getActiveFile: () => File | null;

  actions: FileActions;
}

function withoutPendingNode(pending: Set<string>, nodeId: string): Set<string> {
  if (!pending.has(nodeId)) return pending;
  const next = new Set(pending);
  next.delete(nodeId);
  return next;
}

function withPendingNode(pending: Set<string>, nodeId: string): Set<string> {
  if (pending.has(nodeId)) return pending;
  const next = new Set(pending);
  next.add(nodeId);
  return next;
}

// Zoom tabs sit immediately after their source file and stay grouped together, so a new zoom is
// inserted after the source's existing zoom tabs (or at the end when the source file is not open).
function computeZoomInsertIndex(files: File[], sourceFilePath: string): number {
  const sourceIndex = files.findIndex(f => f.path === sourceFilePath);
  if (sourceIndex === -1) return files.length;

  let insertIndex = sourceIndex + 1;
  while (insertIndex < files.length && files[insertIndex].zoomSource?.sourceFilePath === sourceFilePath) {
    insertIndex++;
  }
  return insertIndex;
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
  reviewPendingNodeIds: new Set<string>(),

  openFile: (path: string, displayName: string, isTemporary?: boolean) => {
    const { files } = get();

    if (files.some(f => f.path === path)) {
      set({ activeFilePath: path });
      const newState = get();
      void persistSession(newState.files, newState.activeFilePath);
      return;
    }

    set({
      files: [...files, { path, displayName, isTemporary }],
      activeFilePath: path,
    });
    const newState = get();
    void persistSession(newState.files, newState.activeFilePath);
  },

  closeFile: (path: string) => {
    const { files, activeFilePath, reviewPendingNodeIds } = get();
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

    const closedZoomNodeId = files.find(f => f.path === path)?.zoomSource?.zoomedNodeId;

    set({
      files: newFiles,
      activeFilePath: newActiveFilePath,
      reviewPendingNodeIds: closedZoomNodeId
        ? withoutPendingNode(reviewPendingNodeIds, closedZoomNodeId)
        : reviewPendingNodeIds,
    });
    const newState = get();
    void persistSession(newState.files, newState.activeFilePath);
  },

  setActiveFile: (path: string) => {
    const { files, reviewPendingNodeIds } = get();
    const focusedZoomNodeId = files.find(f => f.path === path)?.zoomSource?.zoomedNodeId;
    set({
      activeFilePath: path,
      reviewPendingNodeIds: focusedZoomNodeId
        ? withoutPendingNode(reviewPendingNodeIds, focusedZoomNodeId)
        : reviewPendingNodeIds,
    });
    const newState = get();
    void persistSession(newState.files, newState.activeFilePath);
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
    void persistSession(newState.files, newState.activeFilePath);
  },

  openZoomTab: (sourceFilePath: string, nodeId: string, nodeContent: string, options?: OpenZoomTabOptions) => {
    const background = options?.background ?? false;
    const { files, activeFilePath, reviewPendingNodeIds } = get();

    const existingZoom = files.find(
      f => f.zoomSource?.sourceFilePath === sourceFilePath && f.zoomSource?.zoomedNodeId === nodeId
    );

    if (existingZoom) {
      if (background) {
        // Highlight the existing tab as pending rather than stealing focus — unless the user is
        // already looking at it, in which case there is nothing to direct them to.
        if (existingZoom.path !== activeFilePath) {
          set({ reviewPendingNodeIds: withPendingNode(reviewPendingNodeIds, nodeId) });
        }
        return;
      }
      set({ activeFilePath: existingZoom.path });
      const newState = get();
      void persistSession(newState.files, newState.activeFilePath);
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

    const insertIndex = computeZoomInsertIndex(files, sourceFilePath);
    const newFiles = [
      ...files.slice(0, insertIndex),
      newZoomTab,
      ...files.slice(insertIndex),
    ];

    set({
      files: newFiles,
      activeFilePath: background ? activeFilePath : zoomPath,
      reviewPendingNodeIds: background
        ? withPendingNode(reviewPendingNodeIds, nodeId)
        : reviewPendingNodeIds,
    });
    const newState = get();
    void persistSession(newState.files, newState.activeFilePath);
  },

  closeZoomTabsForNode: (nodeId: string) => {
    const { files, activeFilePath, reviewPendingNodeIds } = get();
    const zoomTabsToClose = files.filter(f => f.zoomSource?.zoomedNodeId === nodeId);

    if (zoomTabsToClose.length === 0) {
      // No tab to close, but a pending highlight may still be armed (e.g. the tab was closed
      // manually first) — clear it so a resolved review never leaves a dangling highlight.
      const cleared = withoutPendingNode(reviewPendingNodeIds, nodeId);
      if (cleared !== reviewPendingNodeIds) set({ reviewPendingNodeIds: cleared });
      return;
    }

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
      reviewPendingNodeIds: withoutPendingNode(reviewPendingNodeIds, nodeId),
    });
    const newState = get();
    void persistSession(newState.files, newState.activeFilePath);
  },

  getActiveFile: () => {
    const { files, activeFilePath } = get();
    return files.find(f => f.path === activeFilePath) || null;
  },

  actions: createFileActions(get, storageService, requireStoreAccess),
}));
