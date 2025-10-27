import { vi } from 'vitest';

export const createMockStoreActions = () => ({
  selectNode: vi.fn(),
  updateContent: vi.fn(),
  updateStatus: vi.fn(),
  toggleStatus: vi.fn(),
  deleteNode: vi.fn(),
  setCursorPosition: vi.fn(),
  setRememberedVisualX: vi.fn(),
  createSiblingNode: vi.fn(),
  moveUp: vi.fn(),
  moveDown: vi.fn(),
  moveBack: vi.fn(),
  moveForward: vi.fn(),
  initialize: vi.fn(),
  loadDocument: vi.fn(),
  loadFromPath: vi.fn(),
  saveToPath: vi.fn(),
  setFilePath: vi.fn(),
  autoSave: vi.fn(),
  indentNode: vi.fn(),
  outdentNode: vi.fn(),
  moveNodeUp: vi.fn(),
  moveNodeDown: vi.fn(),
});

export type MockStoreActions = ReturnType<typeof createMockStoreActions>;

export const createPartialMockActions = <T extends Partial<MockStoreActions>>(
  actions: T
): T => actions;
