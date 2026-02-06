import { useIconPickerStore, IconSelection } from '../../../store/iconPicker/iconPickerStore';
import { IconPicker } from './IconPicker';
import { useModalHotkeyContext } from '../../../hooks';

export function IconPickerDialog() {
  const isOpen = useIconPickerStore((state) => state.isOpen);
  const selectedIcon = useIconPickerStore((state) => state.selectedIcon);
  const selectedColor = useIconPickerStore((state) => state.selectedColor);
  const onSelect = useIconPickerStore((state) => state.onSelect);
  const close = useIconPickerStore((state) => state.close);

  useModalHotkeyContext(isOpen);

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
