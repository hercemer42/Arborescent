import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  capturePreviouslyFocusedElement,
  restoreFocusAfterPaint,
  preserveFocusAcross,
} from '../focusPreservation';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('focusPreservation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('capturePreviouslyFocusedElement', () => {
    it('should return the currently focused HTMLElement', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      expect(capturePreviouslyFocusedElement()).toBe(input);
    });

    it('should return null when body is the active element', () => {
      expect(document.activeElement).toBe(document.body);
      expect(capturePreviouslyFocusedElement()).toBeNull();
    });

    it('should return null when no element is focused', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      input.blur();

      expect(capturePreviouslyFocusedElement()).toBeNull();
    });
  });

  describe('restoreFocusAfterPaint', () => {
    it('should restore focus to the element after the next frame', async () => {
      const original = document.createElement('input');
      document.body.appendChild(original);
      original.focus();

      const thief = document.createElement('input');
      document.body.appendChild(thief);
      thief.focus();

      restoreFocusAfterPaint(original);
      expect(document.activeElement).toBe(thief);

      await nextFrame();

      expect(document.activeElement).toBe(original);
    });

    it('should not restore focus when the element is already focused', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const focusSpy = vi.spyOn(input, 'focus');
      restoreFocusAfterPaint(input);
      await nextFrame();

      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('should not restore focus when the element has been removed from the DOM', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const focusSpy = vi.spyOn(input, 'focus');
      input.remove();
      restoreFocusAfterPaint(input);
      await nextFrame();

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe('preserveFocusAcross', () => {
    it('should run the operation and return its result', () => {
      const result = preserveFocusAcross(() => 42);
      expect(result).toBe(42);
    });

    it('should restore focus after the operation when focus is stolen synchronously', async () => {
      const original = document.createElement('input');
      document.body.appendChild(original);
      original.focus();

      const thief = document.createElement('input');
      document.body.appendChild(thief);

      preserveFocusAcross(() => {
        thief.focus();
      });

      await nextFrame();

      expect(document.activeElement).toBe(original);
    });

    it('should not attempt restoration when body is active at capture time', async () => {
      const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
      preserveFocusAcross(() => {});
      await nextFrame();

      expect(focusSpy).not.toHaveBeenCalled();
    });
  });
});
