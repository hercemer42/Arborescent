import { useState, useCallback } from 'react';
import { usePreferencesStore } from '../../../store/preferences/preferencesStore';
import { HotkeyConfig } from '../../../data/hotkeyConfig';
import defaultHotkeys from '../../../data/defaultHotkeys.json';
import { getActionLabel } from '../hotkeyLabels';

function getHotkeyValue(config: HotkeyConfig, category: string, action: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (config as any)[category]?.[action] ?? '';
}

interface EditingAction {
  category: string;
  action: string;
}

export function useKeyboardShortcuts() {
  const hotkeys = usePreferencesStore((state) => state.hotkeys);
  const setHotkey = usePreferencesStore((state) => state.setHotkey);
  const resetHotkeys = usePreferencesStore((state) => state.resetHotkeys);

  const [editingAction, setEditingAction] = useState<EditingAction | null>(null);
  const [pendingKey, setPendingKey] = useState<string>('');

  const handleEdit = useCallback((category: string, action: string) => {
    setEditingAction({ category, action });
    setPendingKey(getHotkeyValue(hotkeys, category, action));
  }, [hotkeys]);

  const handleEditCancel = useCallback(() => {
    setEditingAction(null);
    setPendingKey('');
  }, []);

  const handleEditConfirm = useCallback((newKey: string) => {
    if (editingAction) {
      setHotkey(editingAction.category, editingAction.action, newKey);
      setEditingAction(null);
      setPendingKey('');
    }
  }, [editingAction, setHotkey]);

  const handleRestoreDefaults = useCallback(() => {
    if (window.confirm('Are you sure you want to restore all shortcuts to their defaults?')) {
      resetHotkeys();
    }
  }, [resetHotkeys]);

  const handleRemoveHotkey = useCallback((category: string, action: string) => {
    setHotkey(category, action, '');
  }, [setHotkey]);

  const handleResetHotkey = useCallback((category: string, action: string) => {
    const defaultKey = getHotkeyValue(defaultHotkeys as HotkeyConfig, category, action);
    setHotkey(category, action, defaultKey);
  }, [setHotkey]);

  const getConflict = useCallback((): { category: string; action: string; label: string } | null => {
    if (!editingAction || !pendingKey) return null;

    // Check all categories and actions for conflicts
    for (const category of Object.keys(hotkeys)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categoryHotkeys = (hotkeys as any)[category] as Record<string, string>;
      for (const action of Object.keys(categoryHotkeys)) {
        // Skip the action being edited
        if (category === editingAction.category && action === editingAction.action) {
          continue;
        }
        if (categoryHotkeys[action] === pendingKey) {
          return {
            category,
            action,
            label: getActionLabel(action),
          };
        }
      }
    }

    return null;
  }, [editingAction, pendingKey, hotkeys]);

  const isDefault = useCallback((category: string, action: string): boolean => {
    const currentKey = getHotkeyValue(hotkeys, category, action);
    const defaultKey = getHotkeyValue(defaultHotkeys as HotkeyConfig, category, action);
    return currentKey === defaultKey;
  }, [hotkeys]);

  return {
    hotkeys,
    editingAction,
    pendingKey,
    setPendingKey,
    handleEdit,
    handleEditCancel,
    handleEditConfirm,
    handleRestoreDefaults,
    handleRemoveHotkey,
    handleResetHotkey,
    getConflict,
    isDefault,
  };
}
