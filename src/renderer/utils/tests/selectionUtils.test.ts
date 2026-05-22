import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hasTextSelection,
  isFocusInTerminalOrBrowser,
  isSelectionInContentEditable,
  isSelectionInRichContent,
  selectionSpansSingleNode,
} from '../selectionUtils';

describe('selectionUtils', () => {
  describe('hasTextSelection', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    it('returns false when window.getSelection() is null', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null);
      expect(hasTextSelection()).toBe(false);
    });

    it('returns false when selection is collapsed', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: true,
        toString: () => '',
        anchorNode: null,
      } as unknown as Selection);
      expect(hasTextSelection()).toBe(false);
    });

    it('returns false when selection toString is empty', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => '',
        anchorNode: document.createTextNode(''),
      } as unknown as Selection);
      expect(hasTextSelection()).toBe(false);
    });

    it('returns false when anchorNode is null', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'foo',
        anchorNode: null,
      } as unknown as Selection);
      expect(hasTextSelection()).toBe(false);
    });

    it('returns true when anchor is a text node inside a [contenteditable]', () => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const textNode = document.createTextNode('hello');
      editable.appendChild(textNode);
      document.body.appendChild(editable);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'ell',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(hasTextSelection()).toBe(true);
    });

    it('returns true when anchor is a text node inside a .node-text element that is NOT contenteditable', () => {
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('hello world');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'hello',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(hasTextSelection()).toBe(true);
    });

    it('returns true when anchor is inside a .node-text rendered as inline markdown (e.g. <strong>) without contenteditable', () => {
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const strong = document.createElement('strong');
      const textNode = document.createTextNode('bold');
      strong.appendChild(textNode);
      nodeText.appendChild(strong);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'bold',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(hasTextSelection()).toBe(true);
    });

    it('returns false when anchor is in plain body text outside any node-text or contenteditable container', () => {
      const span = document.createElement('span');
      const textNode = document.createTextNode('orphan');
      span.appendChild(textNode);
      document.body.appendChild(span);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'orphan',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(hasTextSelection()).toBe(false);
    });

    it('returns true when anchor is an element node (not a text node) inside .node-text', () => {
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const inner = document.createElement('span');
      inner.textContent = 'inner';
      nodeText.appendChild(inner);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'inner',
        anchorNode: inner,
      } as unknown as Selection);

      expect(hasTextSelection()).toBe(true);
    });
  });

  describe('isSelectionInContentEditable', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    it('returns true when anchor is inside [contenteditable], even when selection has no visible text', () => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const textNode = document.createTextNode('');
      editable.appendChild(textNode);
      document.body.appendChild(editable);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => '',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(isSelectionInContentEditable()).toBe(true);
    });

    it('returns false when selection is collapsed', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: true,
        toString: () => '',
        anchorNode: null,
      } as unknown as Selection);
      expect(isSelectionInContentEditable()).toBe(false);
    });

    it('returns false when anchor is inside a non-contenteditable .node-text', () => {
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('hello');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'hello',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(isSelectionInContentEditable()).toBe(false);
    });
  });

  describe('isSelectionInRichContent', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    it('returns true when anchor is inside a .node-text with data-rich="true"', () => {
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      nodeText.setAttribute('data-rich', 'true');
      const textNode = document.createTextNode('use foo for X');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'foo',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(isSelectionInRichContent()).toBe(true);
    });

    it('returns false when anchor is inside a .node-text without data-rich', () => {
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('plain');
      nodeText.appendChild(textNode);
      document.body.appendChild(nodeText);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        toString: () => 'plain',
        anchorNode: textNode,
      } as unknown as Selection);

      expect(isSelectionInRichContent()).toBe(false);
    });

    it('returns false when there is no selection', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue(null);
      expect(isSelectionInRichContent()).toBe(false);
    });
  });

  describe('selectionSpansSingleNode', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    it('returns false when selection is collapsed', () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: true,
        anchorNode: null,
        focusNode: null,
      } as unknown as Selection);
      expect(selectionSpansSingleNode()).toBe(false);
    });

    it('returns true when anchor and focus are inside the same [data-node-id] wrapper', () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-node-id', 'node-1');
      const nodeText = document.createElement('div');
      nodeText.className = 'node-text';
      const textNode = document.createTextNode('hello world');
      nodeText.appendChild(textNode);
      wrapper.appendChild(nodeText);
      document.body.appendChild(wrapper);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        anchorNode: textNode,
        focusNode: textNode,
      } as unknown as Selection);

      expect(selectionSpansSingleNode()).toBe(true);
    });

    it('returns false when anchor and focus are in different [data-node-id] wrappers', () => {
      const wrapper1 = document.createElement('div');
      wrapper1.setAttribute('data-node-id', 'node-1');
      const nt1 = document.createElement('div');
      nt1.className = 'node-text';
      const tn1 = document.createTextNode('a');
      nt1.appendChild(tn1);
      wrapper1.appendChild(nt1);
      document.body.appendChild(wrapper1);

      const wrapper2 = document.createElement('div');
      wrapper2.setAttribute('data-node-id', 'node-2');
      const nt2 = document.createElement('div');
      nt2.className = 'node-text';
      const tn2 = document.createTextNode('b');
      nt2.appendChild(tn2);
      wrapper2.appendChild(nt2);
      document.body.appendChild(wrapper2);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        anchorNode: tn1,
        focusNode: tn2,
      } as unknown as Selection);

      expect(selectionSpansSingleNode()).toBe(false);
    });

    it('returns true when both anchor and focus are outside any [data-node-id] (same null scope)', () => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const textNode = document.createTextNode('inside');
      editable.appendChild(textNode);
      document.body.appendChild(editable);

      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        anchorNode: textNode,
        focusNode: textNode,
      } as unknown as Selection);

      expect(selectionSpansSingleNode()).toBe(true);
    });
  });

  describe('isFocusInTerminalOrBrowser', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return false when no element is focused', () => {
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);
      expect(isFocusInTerminalOrBrowser()).toBe(false);
    });

    it('should return true when a webview is focused', () => {
      const mockElement = {
        tagName: 'WEBVIEW',
        closest: vi.fn(),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(true);
    });

    it('should return true when focus is inside terminal-panel', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn((selector: string) => selector === '.terminal-panel' ? {} : null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(true);
    });

    it('should return true when focus is inside browser-panel', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn((selector: string) => selector === '.browser-panel' ? {} : null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(true);
    });

    it('should return false when focus is inside feedback-panel', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn((selector: string) => selector === '.feedback-panel' ? {} : null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(false);
    });

    it('should return false when focus is in main workspace', () => {
      const mockElement = {
        tagName: 'DIV',
        closest: vi.fn(() => null),
      } as unknown as Element;
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(mockElement);

      expect(isFocusInTerminalOrBrowser()).toBe(false);
    });
  });
});
