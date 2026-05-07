import { useCustomizeDialogStore, IconSelection } from '../../../store/customizeDialog/customizeDialogStore';
import { CustomizeDialog } from './CustomizeDialog';
import { useModalHotkeyContext } from '../../../hooks';

export function CustomizeDialogContainer() {
  const isOpen = useCustomizeDialogStore((state) => state.isOpen);
  const selectedIcon = useCustomizeDialogStore((state) => state.selectedIcon);
  const selectedColor = useCustomizeDialogStore((state) => state.selectedColor);
  const selectedCollaborate = useCustomizeDialogStore((state) => state.selectedCollaborate);
  const selectedExecute = useCustomizeDialogStore((state) => state.selectedExecute);
  const showFlagsPicker = useCustomizeDialogStore((state) => state.showFlagsPicker);
  const onSelect = useCustomizeDialogStore((state) => state.onSelect);
  const close = useCustomizeDialogStore((state) => state.close);
  const setCollaborate = useCustomizeDialogStore((state) => state.setCollaborate);
  const setExecute = useCustomizeDialogStore((state) => state.setExecute);

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
      selectedCollaborate={selectedCollaborate}
      selectedExecute={selectedExecute}
      showFlagsPicker={showFlagsPicker}
      onCollaborateChange={setCollaborate}
      onExecuteChange={setExecute}
      onSelect={handleSelect}
      onClose={close}
    />
  );
}
