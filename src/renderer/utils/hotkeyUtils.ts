import acceleratorFormatter from 'electron-accelerator-formatter';

interface KeyBinding {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export function parseKeyNotation(notation: string): KeyBinding {
  const parts = notation.split('+');
  const rawKey = parts[parts.length - 1];
  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;

  const binding: KeyBinding = {
    key,
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  };

  for (let i = 0; i < parts.length - 1; i++) {
    const modifier = parts[i].toLowerCase();
    switch (modifier) {
      case 'cmdorctrl':
      case 'commandorcontrol':
        // Electron's cross-platform modifier: Cmd on Mac, Ctrl on Windows/Linux
        binding.ctrl = true;
        binding.meta = true;
        break;
      case 'ctrl':
      case 'control':
        binding.ctrl = true;
        break;
      case 'shift':
        binding.shift = true;
        break;
      case 'alt':
        binding.alt = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        binding.meta = true;
        break;
    }
  }

  return binding;
}

export function matchesKeyBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;

  if (eventKey !== bindingKey) {
    return false;
  }

  const eventCtrl = event.ctrlKey || false;
  const eventShift = event.shiftKey || false;
  const eventAlt = event.altKey || false;
  const eventMeta = event.metaKey || false;

  const isCmdOrCtrlBinding = binding.ctrl && binding.meta;

  if (isCmdOrCtrlBinding) {
    // For "CmdOrCtrl" bindings: match if EITHER ctrl OR meta is pressed (cross-platform)
    const hasModifier = eventCtrl || eventMeta;
    if (!hasModifier) return false;

    if (eventShift !== binding.shift) return false;
    if (eventAlt !== binding.alt) return false;
  } else {
    if (eventCtrl !== binding.ctrl) return false;
    if (eventShift !== binding.shift) return false;
    if (eventAlt !== binding.alt) return false;
    if (eventMeta !== binding.meta) return false;
  }

  return true;
}

export function matchesKeyNotation(event: KeyboardEvent, notation: string): boolean {
  const binding = parseKeyNotation(notation);
  return matchesKeyBinding(event, binding);
}

/**
 * Format an Electron accelerator for display.
 * Uses electron-accelerator-formatter for platform-specific symbols.
 */
export function formatHotkeyForDisplay(accelerator: string): string {
  if (!accelerator) return '';
  return acceleratorFormatter(accelerator);
}
