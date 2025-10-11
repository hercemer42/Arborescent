import { vi } from 'vitest';

export const createMockStoreActions = () => ({
  selectAndEdit: vi.fn(),
  saveNodeContent: vi.fn(),
  selectNode: vi.fn(),
  startEdit: vi.fn(),
  finishEdit: vi.fn(),
  updateContent: vi.fn(),
  updateStatus: vi.fn(),
  deleteNode: vi.fn(),
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
