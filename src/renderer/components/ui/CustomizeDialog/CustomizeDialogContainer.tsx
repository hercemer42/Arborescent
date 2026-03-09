import { useCustomizeDialogStore, IconSelection } from '../../../store/customizeDialog/customizeDialogStore';
import { CustomizeDialog } from './CustomizeDialog';
import { useModalHotkeyContext } from '../../../hooks';

export function CustomizeDialogContainer() {
  const isOpen = useCustomizeDialogStore((state) => state.isOpen);
  const selectedIcon = useCustomizeDialogStore((state) => state.selectedIcon);
  const selectedColor = useCustomizeDialogStore((state) => state.selectedColor);
  const selectedMode = useCustomizeDialogStore((state) => state.selectedMode);
  const showModeToggle = useCustomizeDialogStore((state) => state.showModeToggle);
  const onSelect = useCustomizeDialogStore((state) => state.onSelect);
  const close = useCustomizeDialogStore((state) => state.close);
  const setMode = useCustomizeDialogStore((state) => state.setMode);

  useModalHotkeyContext(isOpen);

  if (!isOpen || !onSelect) {
    return null;
  }

  const handleSelect = (selection: IconSelection) => {
    onSelect(selection);
    close();
  };

  return (
    <CustomizeDialog
      selectedIcon={selectedIcon ?? undefined}
      selectedColor={selectedColor}
      selectedMode={selectedMode}
      showModeToggle={showModeToggle}
      onModeChange={setMode}
      onSelect={handleSelect}
      onClose={close}
    />
  );
}
