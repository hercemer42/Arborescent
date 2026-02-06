export type HotkeyContext = 'tree' | 'terminal' | 'browser' | 'modal' | 'global';

export interface KeyboardServicesOptions {
  includeUIService?: boolean;
  isInitialized?: boolean;
}