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
  onMenuOpen: vi.fn(),
  onMenuSave: vi.fn(),
  onMenuSaveAs: vi.fn(),
  onMainError: vi.fn(),
};
