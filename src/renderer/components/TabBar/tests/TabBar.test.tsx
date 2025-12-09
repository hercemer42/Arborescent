import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from '../TabBar';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore } from '../../../store/tree/treeStore';

vi.mock('../../../store/storeManager', () => ({
  storeManager: {
    closeFile: vi.fn(),
    getStoreForFile: vi.fn(() => ({
      getState: () => ({
        collaboratingNodeId: null,
      }),
      subscribe: vi.fn(() => () => {}),
    })),
  },
}));

const mockStore = createTreeStore();

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <TreeStoreContext.Provider value={mockStore}>
      {ui}
    </TreeStoreContext.Provider>
  );
};

describe('TabBar', () => {
  beforeEach(() => {
    useFilesStore.setState({
      files: [],
      activeFilePath: null,
    });
    vi.clearAllMocks();
  });

  it('should not render when no files are open', () => {
    const { container } = renderWithProvider(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render tabs for open files', () => {
    useFilesStore.setState({
      files: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
        { path: '/path/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    renderWithProvider(<TabBar />);

    // Extension is stripped in display
    expect(screen.getByText('file1')).toBeInTheDocument();
    expect(screen.getByText('file2')).toBeInTheDocument();
  });

  it('should highlight active tab', () => {
    useFilesStore.setState({
      files: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
        { path: '/path/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    renderWithProvider(<TabBar />);

    const activeTab = screen.getByText('file1').closest('.tab');
    const inactiveTab = screen.getByText('file2').closest('.tab');

    expect(activeTab).toHaveClass('active');
    expect(inactiveTab).not.toHaveClass('active');
  });

  it('should set active file when tab is clicked', async () => {
    const user = userEvent.setup();
    useFilesStore.setState({
      files: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
        { path: '/path/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    renderWithProvider(<TabBar />);

    await user.click(screen.getByText('file2'));

    expect(useFilesStore.getState().activeFilePath).toBe('/path/file2.arbo');
  });

  it('should close file when close button is clicked', async () => {
    const user = userEvent.setup();
    (storeManager.closeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    useFilesStore.setState({
      files: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    renderWithProvider(<TabBar />);

    await user.click(screen.getByRole('button', { name: 'Close tab' }));

    expect(storeManager.closeFile).toHaveBeenCalledWith('/path/file1.arbo');
    expect(useFilesStore.getState().files).toHaveLength(0);
  });

  it('should show full file path as tooltip on hover', () => {
    useFilesStore.setState({
      files: [
        { path: '/home/user/documents/project/file1.arbo', displayName: 'file1.arbo' },
      ],
      activeFilePath: '/home/user/documents/project/file1.arbo',
    });

    renderWithProvider(<TabBar />);

    const tab = screen.getByText('file1').closest('.tab');
    expect(tab).toHaveAttribute('title', '/home/user/documents/project/file1.arbo');
  });
});
