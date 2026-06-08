import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReviewCollapse } from '../useReviewCollapse';
import { useReviewCollapseStore, selectReviewCollapseExpanded } from '../../../../store/reviewCollapse/reviewCollapseStore';

const mainBinding = { view: 'main', seedExpanded: false, reviewedNodeId: 'reviewed' } as const;

describe('useReviewCollapse', () => {
  beforeEach(() => {
    useReviewCollapseStore.setState({ byReview: {} });
  });

  it('returns null when no binding is provided so ordinary nodes keep metadata-driven collapse', () => {
    const { result } = renderHook(() => useReviewCollapse(undefined, 'prop-root'));
    expect(result.current).toBeNull();
  });

  it('falls back to the seed when the user has not toggled this root in this view', () => {
    const { result } = renderHook(() => useReviewCollapse(mainBinding, 'prop-root'));
    expect(result.current?.expanded).toBe(false);
  });

  it('reflects an explicit toggle over the seed without touching the other view', () => {
    const { result } = renderHook(() => useReviewCollapse(mainBinding, 'prop-root'));

    act(() => result.current!.handleToggle());

    expect(result.current?.expanded).toBe(true);
    expect(selectReviewCollapseExpanded(useReviewCollapseStore.getState(), 'reviewed', 'zoom', 'prop-root')).toBeUndefined();
  });
});
