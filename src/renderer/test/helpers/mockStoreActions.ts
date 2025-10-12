import { vi } from 'vitest';

export const createMockStoreActions = () => ({
  selectNode: vi.fn(),
  updateContent: vi.fn(),
  updateStatus: vi.fn(),
  deleteNode: vi.fn(),
  setCursorPosition: vi.fn(),
  setRememberedCursorColumn: vi.fn(),
  moveUp: vi.fn(),
  moveDown: vi.fn(),
  initialize: vi.fn(),
  loadDocument: vi.fn(),
  loadFromPath: vi.fn(),
  saveToPath: vi.fn(),
});

export type MockStoreActions = ReturnType<typeof createMockStoreActions>;

export const createPartialMockActions = <T extends Partial<MockStoreActions>>(
  actions: T
): T => actions;
