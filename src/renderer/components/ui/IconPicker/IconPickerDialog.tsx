import { useIconPickerStore, IconSelection } from '../../../store/iconPicker/iconPickerStore';
import { IconPicker } from './IconPicker';

/**
 * Self-contained IconPicker dialog that connects to the iconPickerStore.
 * Render this once at the app level - it will show/hide based on store state.
 */
export function IconPickerDialog() {
  const isOpen = useIconPickerStore((state) => state.isOpen);
  const selectedIcon = useIconPickerStore((state) => state.selectedIcon);
  const selectedColor = useIconPickerStore((state) => state.selectedColor);
  const onSelect = useIconPickerStore((state) => state.onSelect);
  const close = useIconPickerStore((state) => state.close);

  if (!isOpen || !onSelect) {
    return null;
  }

  const handleSelect = (selection: IconSelection) => {
    onSelect(selection);
    close();
  };

  return (
    <IconPicker
      selectedIcon={selectedIcon ?? undefined}
      selectedColor={selectedColor}
      onSelect={handleSelect}
      onClose={close}
    />
  );
}
