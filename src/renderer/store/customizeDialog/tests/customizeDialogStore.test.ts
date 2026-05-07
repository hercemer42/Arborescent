import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCustomizeDialogStore, IconSelection } from '../customizeDialogStore';

const initialState = {
  isOpen: false,
  selectedIcon: null,
  selectedColor: null,
  selectedCollaborate: null,
  selectedExecute: null,
  showFlagsPicker: false,
  onSelect: null,
};

describe('customizeDialogStore', () => {
  beforeEach(() => {
    useCustomizeDialogStore.setState(initialState);
  });

  it('selectedCollaborate and selectedExecute are independently nullable', () => {
    const { setCollaborate, setExecute } = useCustomizeDialogStore.getState();
    setCollaborate(true);
    expect(useCustomizeDialogStore.getState().selectedCollaborate).toBe(true);
    expect(useCustomizeDialogStore.getState().selectedExecute).toBeNull();

    setExecute(true);
    expect(useCustomizeDialogStore.getState().selectedCollaborate).toBe(true);
    expect(useCustomizeDialogStore.getState().selectedExecute).toBe(true);
  });

  it('open() populates both fields from supplied flags', () => {
    const onSelect = vi.fn();
    useCustomizeDialogStore.getState().open('Star', onSelect, '#fff', {
      showFlagsPicker: true,
      selectedCollaborate: true,
      selectedExecute: false,
    });
    const state = useCustomizeDialogStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.selectedCollaborate).toBe(true);
    expect(state.selectedExecute).toBe(false);
    expect(state.showFlagsPicker).toBe(true);
  });

  it('close() resets both flag fields back to null', () => {
    const onSelect = vi.fn();
    useCustomizeDialogStore.getState().open('Star', onSelect, '#fff', {
      showFlagsPicker: true,
      selectedCollaborate: true,
      selectedExecute: true,
    });
    useCustomizeDialogStore.getState().close();
    const state = useCustomizeDialogStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.selectedCollaborate).toBeNull();
    expect(state.selectedExecute).toBeNull();
    expect(state.showFlagsPicker).toBe(false);
  });

  it('persists Action through a save round-trip without coercing to a default', () => {
    let captured: IconSelection | null = null;
    useCustomizeDialogStore.getState().open(
      'Star',
      (selection) => { captured = selection; },
      null,
      { showFlagsPicker: true, selectedCollaborate: false, selectedExecute: false },
    );

    const { setCollaborate, setExecute, onSelect } = useCustomizeDialogStore.getState();
    setCollaborate(false);
    setExecute(false);
    onSelect?.({ icon: 'Star', collaborate: false, execute: false });

    expect(captured).toEqual({ icon: 'Star', collaborate: false, execute: false });
  });

  it('toggling each setter individually leaves the other untouched', () => {
    useCustomizeDialogStore.getState().open('Star', vi.fn(), null, {
      showFlagsPicker: true,
      selectedCollaborate: false,
      selectedExecute: true,
    });

    useCustomizeDialogStore.getState().setCollaborate(true);
    expect(useCustomizeDialogStore.getState().selectedExecute).toBe(true);

    useCustomizeDialogStore.getState().setExecute(false);
    expect(useCustomizeDialogStore.getState().selectedCollaborate).toBe(true);
  });

  it('open() defaults selected flags to null when not provided', () => {
    useCustomizeDialogStore.getState().open('Star', vi.fn());
    const state = useCustomizeDialogStore.getState();
    expect(state.selectedCollaborate).toBeNull();
    expect(state.selectedExecute).toBeNull();
    expect(state.showFlagsPicker).toBe(false);
  });
});
