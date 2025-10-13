import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { storeManager } from '../../store/storeManager';

vi.mock('../../store/storeManager', () => ({
  storeManager: {
    closeFile: vi.fn(),
  },
}));

describe('TabBar', () => {
  beforeEach(() => {
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
    });
    vi.clearAllMocks();
  });

  it('should not render when no files are open', () => {
    const { container } = render(<TabBar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render tabs for open files', () => {
    useTabsStore.setState({
      openFiles: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
        { path: '/path/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    render(<TabBar />);

    expect(screen.getByText('file1.arbo')).toBeInTheDocument();
    expect(screen.getByText('file2.arbo')).toBeInTheDocument();
  });

  it('should highlight active tab', () => {
    useTabsStore.setState({
      openFiles: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
        { path: '/path/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    render(<TabBar />);

    const activeTab = screen.getByText('file1.arbo').closest('.tab');
    const inactiveTab = screen.getByText('file2.arbo').closest('.tab');

    expect(activeTab).toHaveClass('active');
    expect(inactiveTab).not.toHaveClass('active');
  });

  it('should set active file when tab is clicked', async () => {
    const user = userEvent.setup();
    useTabsStore.setState({
      openFiles: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
        { path: '/path/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    render(<TabBar />);

    await user.click(screen.getByText('file2.arbo'));

    expect(useTabsStore.getState().activeFilePath).toBe('/path/file2.arbo');
  });

  it('should close file when close button is clicked', async () => {
    const user = userEvent.setup();
    useTabsStore.setState({
      openFiles: [
        { path: '/path/file1.arbo', displayName: 'file1.arbo' },
      ],
      activeFilePath: '/path/file1.arbo',
    });

    render(<TabBar />);

    await user.click(screen.getByRole('button', { name: 'Close tab' }));

    expect(storeManager.closeFile).toHaveBeenCalledWith('/path/file1.arbo');
    expect(useTabsStore.getState().openFiles).toHaveLength(0);
  });
});
