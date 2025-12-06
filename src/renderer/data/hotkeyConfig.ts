import defaultHotkeysData from './defaultHotkeys.json';
import { matchesKeyNotation } from '../utils/hotkeyUtils';

export interface HotkeyConfig {
  navigation: {
    moveUp: string;
    moveDown: string;
    moveLeft: string;
    moveRight: string;
    expandCollapse: string;
    toggleNode: string;
    moveNodeUp: string;
    moveNodeDown: string;
  };
  editing: {
    startEdit: string;
    cancelEdit: string;
    saveEdit: string;
    deleteLine: string;
    newSiblingAfter: string;
    newChildNode: string;
    indent: string;
    outdent: string;
  };
  actions: {
    toggleTaskStatus: string;
    deleteNode: string;
    undo: string;
    redo: string;
    cut: string;
    copy: string;
    paste: string;
  };
  file: {
    new: string;
    save: string;
    saveAs: string;
    open: string;
    closeTab: string;
    reload: string;
    quit: string;
  };
  view: {
    toggleTerminal: string;
    toggleBrowser: string;
    toggleBlueprintMode: string;
    toggleSummaryMode: string;
  };
}

export type HotkeyContext = keyof HotkeyConfig;

let currentConfig: HotkeyConfig = defaultHotkeysData as HotkeyConfig;

export function getHotkeyConfig(): HotkeyConfig {
  return currentConfig;
}

export function getKeyForAction(
  context: HotkeyContext,
  action: string
): string | undefined {
  return (currentConfig[context] as Record<string, string>)?.[action];
}

export function matchesHotkey(
  event: KeyboardEvent,
  context: HotkeyContext,
  action: string
): boolean {
  const notation = getKeyForAction(context, action);
  return notation ? matchesKeyNotation(event, notation) : false;
}

export function setHotkeyConfig(config: HotkeyConfig): void {
  currentConfig = config;
}

export function resetHotkeyConfig(): void {
  currentConfig = defaultHotkeysData as HotkeyConfig;
}
