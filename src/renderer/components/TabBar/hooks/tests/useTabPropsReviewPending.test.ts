import { describe, it, expect } from 'vitest';
import { getTabProps } from '../useTabProps';
import { File } from '../../../../store/files/filesStore';

const zoomFile: File = {
  path: 'zoom:///path/source.arbo#node-1',
  displayName: 'Node 1',
  zoomSource: { sourceFilePath: '/path/source.arbo', zoomedNodeId: 'node-1' },
};

const regularFile: File = {
  path: '/path/source.arbo',
  displayName: 'source.arbo',
};

describe('getTabProps — review-pending highlight', () => {
  it('marks a zoom tab as review-pending when the caller flags it', () => {
    expect(getTabProps(zoomFile, undefined, true).isReviewPending).toBe(true);
  });

  it('is not review-pending by default', () => {
    expect(getTabProps(zoomFile, undefined).isReviewPending).toBe(false);
  });

  it('never marks a non-zoom (regular file) tab as review-pending, even if flagged', () => {
    expect(getTabProps(regularFile, undefined, true).isReviewPending).toBe(false);
  });
});
