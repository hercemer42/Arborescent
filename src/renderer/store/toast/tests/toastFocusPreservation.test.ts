import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToastStore } from '../toastStore';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('toastStore focus preservation', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should not move focus when addToast is called and nothing else steals it', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    useToastStore.getState().addToast('Hello', 'info');
    await nextFrame();

    expect(document.activeElement).toBe(input);
  });

  it('should restore focus when another code path moves focus synchronously after addToast', async () => {
    const original = document.createElement('input');
    document.body.appendChild(original);
    original.focus();

    const thief = document.createElement('input');
    document.body.appendChild(thief);

    useToastStore.getState().addToast('Simulated workflow advance', 'info');
    thief.focus();
    expect(document.activeElement).toBe(thief);

    await nextFrame();

    expect(document.activeElement).toBe(original);
  });

  it('should restore focus when focus is lost to body after addToast', async () => {
    const original = document.createElement('input');
    document.body.appendChild(original);
    original.focus();

    useToastStore.getState().addToast('Lost focus scenario', 'info');
    (document.activeElement as HTMLElement | null)?.blur();

    await nextFrame();

    expect(document.activeElement).toBe(original);
  });

  it('should not restore focus if the previously focused element is no longer in the DOM', async () => {
    const transient = document.createElement('input');
    document.body.appendChild(transient);
    transient.focus();

    useToastStore.getState().addToast('Transient element scenario', 'info');
    transient.remove();

    await nextFrame();

    expect(document.activeElement).not.toBe(transient);
    expect(document.body.contains(transient)).toBe(false);
  });

  it('should not attempt to restore when nothing was focused before the toast', async () => {
    (document.activeElement as HTMLElement | null)?.blur();

    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    useToastStore.getState().addToast('No prior focus', 'info');
    await nextFrame();

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('should preserve focus across multiple rapid addToast calls', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const thief = document.createElement('input');
    document.body.appendChild(thief);

    const addToast = useToastStore.getState().addToast;
    addToast('First', 'info');
    addToast('Second', 'error');
    addToast('Third', 'success');
    thief.focus();

    await nextFrame();

    expect(document.activeElement).toBe(input);
  });

  it('should preserve focus when adding a toast with action buttons', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const thief = document.createElement('input');
    document.body.appendChild(thief);

    useToastStore.getState().addToast('With actions', 'info', {
      actions: [{ label: 'OK', onClick: () => {} }],
    });
    thief.focus();

    await nextFrame();

    expect(document.activeElement).toBe(input);
  });

  it('should preserve focus when adding a persistent toast', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const thief = document.createElement('input');
    document.body.appendChild(thief);

    useToastStore.getState().addToast('Persistent', 'warning', { persistent: true });
    thief.focus();

    await nextFrame();

    expect(document.activeElement).toBe(input);
  });

  it('should not restore focus if the element is no longer focusable (removed from DOM)', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    useToastStore.getState().addToast('Element gone', 'info');
    input.remove();

    await nextFrame();

    expect(document.activeElement).not.toBe(input);
  });

  it('should handle all toast types without stealing focus', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const thief = document.createElement('input');
    document.body.appendChild(thief);

    const types: Array<'error' | 'warning' | 'success' | 'info'> = [
      'error',
      'warning',
      'success',
      'info',
    ];

    for (const type of types) {
      input.focus();
      useToastStore.getState().addToast(`Test ${type}`, type);
      thief.focus();
      await nextFrame();
      expect(document.activeElement).toBe(input);
    }
  });

  it('should not interfere when addToast is called with no focused element (document.body is active)', async () => {
    expect(document.activeElement).toBe(document.body);

    const thief = document.createElement('input');
    document.body.appendChild(thief);

    useToastStore.getState().addToast('Body was active', 'info');
    thief.focus();

    await nextFrame();

    expect(document.activeElement).toBe(thief);
  });
});
