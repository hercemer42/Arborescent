import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

vi.mock('zustand');

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

global.window.electron = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showUnsavedChangesDialog: vi.fn(),
  saveSession: vi.fn(),
  getSession: vi.fn(),
  getTempDir: vi.fn(),
  createTempFile: vi.fn(),
  deleteTempFile: vi.fn(),
  listTempFiles: vi.fn(),
  saveTempFilesMetadata: vi.fn(),
  getTempFilesMetadata: vi.fn(),
  setMenuNewHandler: vi.fn(),
  setMenuOpenHandler: vi.fn(),
  setMenuSaveHandler: vi.fn(),
  setMenuSaveAsHandler: vi.fn(),
  setMainErrorHandler: vi.fn(),
};
