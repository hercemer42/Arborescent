import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu, ContextMenuItem } from '../ContextMenu';

describe('ContextMenu', () => {
  const mockOnClose = vi.fn();
  const mockItem1Click = vi.fn();
  const mockItem2Click = vi.fn();
  const mockItem3Click = vi.fn();

  const defaultItems: ContextMenuItem[] = [
    { label: 'Item 1', onClick: mockItem1Click },
    { label: 'Item 2', onClick: mockItem2Click },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render at specified coordinates', () => {
    const { container } = render(
      <ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />
    );

    const menu = container.querySelector('.context-menu') as HTMLElement;
    expect(menu).toBeDefined();
    expect(menu?.style.left).toBe('100px');
    expect(menu?.style.top).toBe('200px');
  });

  it('should render all menu items', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />);

    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Item 2')).toBeDefined();
  });

  it('should call item onClick and onClose when item is clicked', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />);

    const item1 = screen.getByText('Item 1');
    fireEvent.click(item1);

    expect(mockItem1Click).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple item clicks', () => {
    const { rerender } = render(
      <ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />
    );

    const item2 = screen.getByText('Item 2');
    fireEvent.click(item2);

    expect(mockItem2Click).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Reset mocks and re-render to test second item
    vi.clearAllMocks();
    rerender(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />);

    const item1 = screen.getByText('Item 1');
    fireEvent.click(item1);

    expect(mockItem1Click).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should apply danger class to danger items', () => {
    const dangerItems: ContextMenuItem[] = [
      { label: 'Normal Item', onClick: mockItem1Click },
      { label: 'Danger Item', onClick: mockItem2Click, danger: true },
    ];

    render(<ContextMenu x={100} y={200} items={dangerItems} onClose={mockOnClose} />);

    const normalItem = screen.getByText('Normal Item').closest('.context-menu-item');
    const dangerItem = screen.getByText('Danger Item').closest('.context-menu-item');

    expect(normalItem?.className).not.toContain('danger');
    expect(dangerItem?.className).toContain('danger');
  });

  it('should handle disabled items', () => {
    const disabledItems: ContextMenuItem[] = [
      { label: 'Enabled Item', onClick: mockItem1Click },
      { label: 'Disabled Item', onClick: mockItem2Click, disabled: true },
    ];

    render(<ContextMenu x={100} y={200} items={disabledItems} onClose={mockOnClose} />);

    const enabledItem = screen.getByText('Enabled Item');
    const disabledItem = screen.getByText('Disabled Item');

    expect(enabledItem).toBeDefined();
    expect(disabledItem).toBeDefined();

    // Disabled items should not trigger onClick
    fireEvent.click(disabledItem);
    expect(mockItem2Click).not.toHaveBeenCalled();

    // Enabled items should still work
    fireEvent.click(enabledItem);
    expect(mockItem1Click).toHaveBeenCalledTimes(1);
  });

  it('should close menu on Escape key', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not close on other keys', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Space' });
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should close menu when clicking outside', () => {
    render(<ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />);

    fireEvent.mouseDown(document.body);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not close when clicking inside menu', () => {
    const { container } = render(
      <ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />
    );

    const menu = container.querySelector('.context-menu');
    fireEvent.mouseDown(menu!);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should render empty menu with no items', () => {
    const { container } = render(
      <ContextMenu x={100} y={200} items={[]} onClose={mockOnClose} />
    );

    const menu = container.querySelector('.context-menu');
    expect(menu).toBeDefined();
    expect(menu?.children.length).toBe(0);
  });

  it('should handle many items', () => {
    const manyItems: ContextMenuItem[] = Array.from({ length: 10 }, (_, i) => ({
      label: `Item ${i + 1}`,
      onClick: vi.fn(),
    }));

    render(<ContextMenu x={100} y={200} items={manyItems} onClose={mockOnClose} />);

    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Item ${i}`)).toBeDefined();
    }
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(
      <ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should update position when props change', () => {
    const { container, rerender } = render(
      <ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} />
    );

    let menu = container.querySelector('.context-menu') as HTMLElement;
    expect(menu?.style.left).toBe('100px');
    expect(menu?.style.top).toBe('200px');

    rerender(<ContextMenu x={300} y={400} items={defaultItems} onClose={mockOnClose} />);

    menu = container.querySelector('.context-menu') as HTMLElement;
    expect(menu?.style.left).toBe('300px');
    expect(menu?.style.top).toBe('400px');
  });

  it('should handle items with both danger and disabled flags', () => {
    const complexItems: ContextMenuItem[] = [
      { label: 'Normal', onClick: mockItem1Click },
      { label: 'Danger', onClick: mockItem2Click, danger: true },
      { label: 'Disabled Danger', onClick: mockItem3Click, danger: true, disabled: true },
    ];

    render(<ContextMenu x={100} y={200} items={complexItems} onClose={mockOnClose} />);

    const dangerItem = screen.getByText('Danger').closest('.context-menu-item');
    const disabledDangerItem = screen.getByText('Disabled Danger').closest('.context-menu-item');

    expect(dangerItem?.className).toContain('danger');
    expect(disabledDangerItem?.className).toContain('danger');
  });
});
