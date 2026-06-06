import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const mockAccept = vi.fn();
const mockCancel = vi.fn();

vi.mock('../../Feedback/hooks/useFeedbackActions', () => ({
  useFeedbackActions: () => ({ handleAccept: mockAccept, handleCancel: mockCancel }),
}));

import { ReviewControlBar } from '../ReviewControlBar';

describe('ReviewControlBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Accept and Cancel as buttons', () => {
    render(<ReviewControlBar />);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('exposes the controls as a labelled group for assistive technology', () => {
    render(<ReviewControlBar />);
    expect(screen.getByRole('group', { name: 'Review proposed changes' })).toBeTruthy();
  });

  it('promotes the proposition when Accept is clicked', () => {
    render(<ReviewControlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(mockAccept).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('discards the proposition when Cancel is clicked', () => {
    render(<ReviewControlBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockAccept).not.toHaveBeenCalled();
  });
});
