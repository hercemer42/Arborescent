import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Workspace } from './Workspace';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';

vi.mock('../Tree', () => ({
  Tree: () => <div data-testid="tree">Tree Component</div>,
}));

vi.mock('../TabBar', () => ({
  TabBar: () => <div data-testid="tabbar">TabBar Component</div>,
}));

vi.mock('../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(),
  },
}));

describe('Workspace', () => {
  beforeEach(() => {
    useFilesStore.setState({
      openFiles: [],
      activeFilePath: null,
    });
    vi.clearAllMocks();
  });

  it('should return null when no active file', () => {
    useFilesStore.setState({ activeFilePath: null });

    const { container } = render(<Workspace />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('tree')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tabbar')).not.toBeInTheDocument();
  });

  it('should render TabBar and Tree when active file exists', () => {
    const mockStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
    };

    useFilesStore.setState({ activeFilePath: '/path/to/file.arbo' });
    vi.mocked(storeManager.getStoreForFile).mockReturnValue(mockStore);

    render(<Workspace />);

    expect(screen.getByTestId('tabbar')).toBeInTheDocument();
    expect(screen.getByTestId('tree')).toBeInTheDocument();
  });

  it('should call storeManager.getStoreForFile with active file path', () => {
    const mockStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
    };

    useFilesStore.setState({ activeFilePath: '/test/path.arbo' });
    vi.mocked(storeManager.getStoreForFile).mockReturnValue(mockStore);

    render(<Workspace />);

    expect(storeManager.getStoreForFile).toHaveBeenCalledWith('/test/path.arbo');
  });

  it('should render with workspace class', () => {
    const mockStore = {
      getState: vi.fn(),
      setState: vi.fn(),
      subscribe: vi.fn(),
      destroy: vi.fn(),
    };

    useFilesStore.setState({ activeFilePath: '/path/to/file.arbo' });
    vi.mocked(storeManager.getStoreForFile).mockReturnValue(mockStore);

    const { container } = render(<Workspace />);

    const workspace = container.querySelector('.workspace');
    expect(workspace).toBeInTheDocument();
    expect(workspace?.tagName).toBe('MAIN');
  });

  it('should return null if storeManager returns null', () => {
    useFilesStore.setState({ activeFilePath: '/path/to/file.arbo' });
    vi.mocked(storeManager.getStoreForFile).mockReturnValue(null);

    const { container } = render(<Workspace />);

    expect(container.firstChild).toBeNull();
  });
});
