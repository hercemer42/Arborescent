import { HotkeyConfig } from '../../shared/types';
import defaultHotkeys from '../../../arbo/hotkeys.json';

type HotkeyHandler = (event: KeyboardEvent) => void;

class HotkeyService {
  private config: HotkeyConfig;
  private handlers: Map<string, HotkeyHandler[]>;

  constructor() {
    this.config = defaultHotkeys as HotkeyConfig;
    this.handlers = new Map();
  }

  private matchesKey(event: KeyboardEvent, keyString: string): boolean {
    const parts = keyString.split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    if (modifiers.includes('Mod') && !modKey) return false;
    if (modifiers.includes('Shift') && !event.shiftKey) return false;
    if (modifiers.includes('Alt') && !event.altKey) return false;

    return event.key === key || event.code === key;
  }

  register(action: string, handler: HotkeyHandler): () => void {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, []);
    }
    this.handlers.get(action)!.push(handler);

    return () => {
      const handlers = this.handlers.get(action);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    for (const [action, handlers] of this.handlers.entries()) {
      const keyBinding = this.getKeyBinding(action);
      if (keyBinding && handlers.length > 0 && this.matchesKey(event, keyBinding)) {
        event.preventDefault();
        handlers.forEach((handler) => handler(event));
        return true;
      }
    }
    return false;
  }

  private getKeyBinding(action: string): string | undefined {
    const parts = action.split('.');
    if (parts.length === 2) {
      const [category, key] = parts;
      const categoryConfig = this.config[category as keyof HotkeyConfig];
      if (categoryConfig && typeof categoryConfig === 'object') {
        return categoryConfig[key as keyof typeof categoryConfig];
      }
    }
    return undefined;
  }

  getConfig(): HotkeyConfig {
    return this.config;
  }

  clearAllHandlers(): void {
    this.handlers.clear();
  }
}

export const hotkeyService = new HotkeyService();
