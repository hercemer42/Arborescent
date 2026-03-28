import { create } from 'zustand';
import { createBrowserActions, BrowserActions } from './actions/browserActions';
import { StorageService } from '../../services/storageService';
import { BrowserTab } from '../../../shared/interfaces';

export type { BrowserTab };

export const DEFAULT_BROWSER_URL = 'https://ecosia.org';

export interface FileBrowserState {
  tabs: BrowserTab[];
  activeTabId: string | null;
}

export interface PendingLegacyTabs {
  tabs: BrowserTab[];
  activeTabId: string | null;
}

export interface BrowserState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  currentFilePath: string | null;
  fileStates: Record<string, FileBrowserState>;
  pendingLegacyTabs?: PendingLegacyTabs;
  panelPosition: 'side' | 'bottom';
  isBrowserVisible: boolean;
  panelHeight: number;
  panelWidth: number;
}

interface BrowserStore extends BrowserState {
  actions: BrowserActions;
}

const storageService = new StorageService();

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  currentFilePath: null,
  fileStates: {},
  panelPosition: 'side',
  isBrowserVisible: false,
  panelHeight: 300,
  panelWidth: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,

  actions: createBrowserActions(get, set, storageService),
}));
