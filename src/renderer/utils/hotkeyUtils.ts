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
      case 'mod':
        // "Mod" sets both ctrl and meta so matchesKeyBinding can use OR logic
        // This enables cross-platform matching: Ctrl on Windows/Linux, Cmd on Mac
        binding.ctrl = true;
        binding.meta = true;
        break;
      case 'ctrl':
        binding.ctrl = true;
        break;
      case 'shift':
        binding.shift = true;
        break;
      case 'alt':
        binding.alt = true;
        break;
      case 'meta':
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

  const isModBinding = binding.ctrl && binding.meta;

  if (isModBinding) {
    // For "Mod" bindings: match if EITHER ctrl OR meta is pressed (cross-platform)
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
