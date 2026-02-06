import { HotkeyContext } from './types';

let currentContext: HotkeyContext = 'tree';
let isInitialized = false;

export function setHotkeyContext(context: HotkeyContext): void {
  currentContext = context;
}

export function getHotkeyContext(): string {
  return currentContext;
}

export function setInitialized(initialized: boolean): void {
  isInitialized = initialized;
}

export function getInitialized(): boolean {
  return isInitialized;
}

export function isHotkeyActiveInContext(requiredContext: string): boolean {
  if (!isInitialized) return false;
  if (requiredContext === 'global') return true;
  if (currentContext === 'modal') return false;
  return currentContext === requiredContext;
}