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
 * Detect if running on macOS.
 */
const isMac = (): boolean => navigator.platform?.includes('Mac') ?? false;

/**
 * Format an Electron accelerator for display with platform-specific symbols.
 */
export function formatHotkeyForDisplay(accelerator: string): string {
  if (!accelerator) return '';

  const mac = isMac();
  const formatted = accelerator.split('+').map((part) => {
    switch (part.toLowerCase()) {
      case 'cmdorctrl':
      case 'commandorcontrol':
        return mac ? '⌘' : 'Ctrl';
      case 'cmd':
      case 'command':
        return mac ? '⌘' : 'Cmd';
      case 'ctrl':
      case 'control':
        return mac ? '⌃' : 'Ctrl';
      case 'shift':
        return mac ? '⇧' : 'Shift';
      case 'alt':
      case 'option':
        return mac ? '⌥' : 'Alt';
      case 'altgr':
        return 'AltGr';
      case 'super':
      case 'meta':
        return mac ? '⌘' : 'Super';
      default:
        return part.length === 1 ? part.toUpperCase() : part;
    }
  });

  return mac ? formatted.join('') : formatted.join('+');
}

/**
 * Convert a KeyboardEvent to Electron accelerator notation.
 */
export function keyEventToNotation(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey || event.metaKey) {
    parts.push('CmdOrCtrl');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  if (event.altKey) {
    parts.push('Alt');
  }

  // Normalize key
  let key = event.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);
  return parts.join('+');
}
