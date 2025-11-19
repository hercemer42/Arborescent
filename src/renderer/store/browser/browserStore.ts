import { create } from 'zustand';
import { createBrowserActions, BrowserActions } from './actions/browserActions';
import { StorageService } from '@platform';
import { BrowserTab } from '../../../shared/interfaces';

export type { BrowserTab };

export const DEFAULT_BROWSER_URL = 'https://ecosia.org';

interface BrowserState {
  tabs: BrowserTab[];
  activeTabId: string | null;
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
  panelPosition: 'side',
  isBrowserVisible: false,
  panelHeight: 300,
  panelWidth: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,

  actions: createBrowserActions(get, set, storageService),
}));
