import type { ElectronAPI } from './shared/types/electronApi';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
