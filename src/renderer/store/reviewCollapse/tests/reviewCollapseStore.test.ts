import { describe, it, expect, beforeEach } from 'vitest';
import { useReviewCollapseStore, selectReviewCollapseExpanded } from '../reviewCollapseStore';

function expanded(reviewedNodeId: string, view: 'main' | 'zoom', propositionRootId: string): boolean | undefined {
  return selectReviewCollapseExpanded(useReviewCollapseStore.getState(), reviewedNodeId, view, propositionRootId);
}

describe('reviewCollapseStore', () => {
  beforeEach(() => {
    useReviewCollapseStore.setState({ byReview: {} });
  });

  it('stores an explicit expanded value per view and proposition root', () => {
    useReviewCollapseStore.getState().setExpanded('reviewed', 'main', 'prop-root', false);
    expect(expanded('reviewed', 'main', 'prop-root')).toBe(false);
  });

  it('returns undefined when no explicit value has been set, leaving the seed to the caller', () => {
    expect(expanded('reviewed', 'zoom', 'prop-root')).toBeUndefined();
  });

  it('keeps main-view and zoom-view entries independent for the same proposition root', () => {
    const { setExpanded } = useReviewCollapseStore.getState();
    setExpanded('reviewed', 'main', 'prop-root', false);
    expect(expanded('reviewed', 'zoom', 'prop-root')).toBeUndefined();

    setExpanded('reviewed', 'zoom', 'prop-root', true);
    expect(expanded('reviewed', 'main', 'prop-root')).toBe(false);
    expect(expanded('reviewed', 'zoom', 'prop-root')).toBe(true);
  });

  it('keeps entries for different proposition roots independent within one view', () => {
    const { setExpanded } = useReviewCollapseStore.getState();
    setExpanded('reviewed', 'main', 'prop-a', false);
    setExpanded('reviewed', 'main', 'prop-b', true);
    expect(expanded('reviewed', 'main', 'prop-a')).toBe(false);
    expect(expanded('reviewed', 'main', 'prop-b')).toBe(true);
  });

  it('clears every entry for a review on clearForReview but leaves other reviews intact', () => {
    const { setExpanded, clearForReview } = useReviewCollapseStore.getState();
    setExpanded('reviewed', 'main', 'prop-root', false);
    setExpanded('reviewed', 'zoom', 'prop-root', true);
    setExpanded('other', 'main', 'other-root', false);

    clearForReview('reviewed');

    expect(expanded('reviewed', 'main', 'prop-root')).toBeUndefined();
    expect(expanded('reviewed', 'zoom', 'prop-root')).toBeUndefined();
    expect(expanded('other', 'main', 'other-root')).toBe(false);
  });
});
