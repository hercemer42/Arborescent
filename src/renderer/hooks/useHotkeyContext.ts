import { useEffect } from 'react';
import { usePanelStore } from '../store/panel/panelStore';
import { useSetHotkeyContext, useSetHotkeyInitialized } from '../store/hotkey/hotkeyContextStore';

export function useHotkeyContext(isInitializing: boolean): void {
  const activeContent = usePanelStore((state) => state.activeContent);
  const setContext = useSetHotkeyContext();
  const setInitialized = useSetHotkeyInitialized();
  
  useEffect(() => {
    setInitialized(!isInitializing);
  }, [isInitializing, setInitialized]);

  useEffect(() => {
    if (activeContent === 'terminal') {
      setContext('terminal');
    } else if (activeContent === 'browser') {
      setContext('browser');
    } else {
      setContext('tree');
    }
  }, [activeContent, setContext]);
}

export function useModalHotkeyContext(isModalOpen: boolean): void {
  const setContext = useSetHotkeyContext();
  
  useEffect(() => {
    if (isModalOpen) {
      setContext('modal');
    } else {
      setContext('tree');
    }
  }, [isModalOpen, setContext]);
}