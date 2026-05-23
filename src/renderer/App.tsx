import { useState, useRef, useCallback, useEffect } from "react";
import { ToastContainer } from "./components/ui/Toast";
import { Workspace } from "./components/Workspace";
import { Panel } from "./components/Panel";
import { BottomStatusBar } from "./components/BottomStatusBar/BottomStatusBar";
import { SearchBar } from "./components/SearchBar";
import { AppMenuBar } from "./components/MenuBar";
import { CustomizeDialogContainer } from "./components/ui/CustomizeDialog/CustomizeDialogContainer";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcuts";
import { RebindConfirmationContainer } from "./components/ui/RebindConfirmationDialog";
import { TerminalCloseConfirmationContainer } from "./components/ui/TerminalCloseConfirmationDialog";
import { useToastStore } from "./store/toast/toastStore";
import { usePanelStore } from "./store/panel/panelStore";
import { useSearchStore } from "./store/search/searchStore";
import { useUIStore } from "./store/ui/uiStore";
import { initializeKeyboardServices } from "./services/keyboard/keyboard";
import { startMcpTreeReaderService } from "./services/mcpTreeReaderService";
import { startMcpTreeMutatorService } from "./services/mcpTreeMutatorService";
import { startMcpStepOutputApplierService } from "./services/mcpStepOutputApplierService";
import { startMcpProposalReceiverService } from "./services/mcpProposalReceiverService";
import {
  useAppErrorHandling,
  useAppInitialization,
  useSpellcheckListener,
  useHotkeyContext,
  useHookEventListener,
} from "./hooks";
import "./App.css";

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const panelPosition = usePanelStore((state) => state.panelPosition);
  const activeContent = usePanelStore((state) => state.activeContent);
  const isPanelVisible = activeContent !== null;

  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const isSearchOpen = useSearchStore((state) => state.isOpen);
  const isKeyboardShortcutsOpen = useUIStore(
    (state) => state.isKeyboardShortcutsOpen,
  );
  const closeKeyboardShortcuts = useUIStore(
    (state) => state.closeKeyboardShortcuts,
  );

  const handleInitComplete = useCallback(() => setIsInitializing(false), []);
  useAppInitialization(handleInitComplete);
  useAppErrorHandling();
  useHookEventListener();
  useSpellcheckListener();
  useHotkeyContext(isInitializing);

  useEffect(() => {
    if (isInitializing) return;
    return initializeKeyboardServices(window);
  }, [isInitializing]);

  useEffect(() => {
    return startMcpTreeReaderService();
  }, []);

  useEffect(() => {
    return startMcpTreeMutatorService();
  }, []);

  useEffect(() => {
    return startMcpStepOutputApplierService();
  }, []);

  useEffect(() => {
    return startMcpProposalReceiverService();
  }, []);

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <AppMenuBar />

      {!isInitializing && (
        <div
          className={`app-content ${
            isPanelVisible && panelPosition === "side"
              ? "side-layout"
              : "bottom-layout"
          }`}
          ref={contentRef}
        >
          <div className="workspace-container">
            <Workspace />
          </div>
          <Panel contentRef={contentRef} />
        </div>
      )}

      {isSearchOpen ? <SearchBar /> : <BottomStatusBar />}
      <CustomizeDialogContainer />
      <KeyboardShortcutsDialog
        isOpen={isKeyboardShortcutsOpen}
        onClose={closeKeyboardShortcuts}
      />
      <RebindConfirmationContainer />
      <TerminalCloseConfirmationContainer />
    </div>
  );
}
