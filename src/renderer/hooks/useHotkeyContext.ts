import { useEffect } from 'react';
import { useSetHotkeyContext, useSetHotkeyInitialized } from '../store/hotkey/hotkeyContextStore';

export function useHotkeyContext(isInitializing: boolean): void {
  const setInitialized = useSetHotkeyInitialized();

  useEffect(() => {
    setInitialized(!isInitializing);
  }, [isInitializing, setInitialized]);
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