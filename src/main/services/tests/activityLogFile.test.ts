import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  appendActivityEntry,
  readRecentActivityEntries,
  trimActivityFile,
  type PersistedActivityEntry,
} from '../activityLogFile';

// PR1: the activity log is persisted to a local JSONL file in app user-data.
// These functions take an explicit filePath (dependency injection) so they can
// be exercised against a tmp dir; production callers pass the resolved
// app.getPath('userData') location.
let dir: string;
let filePath: string;

const makeEntry = (i: number): PersistedActivityEntry => ({
  id: `${i}-id`,
  message: `entry-${i}`,
  type: 'info',
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbo-activity-'));
  filePath = path.join(dir, 'activity.jsonl');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('activityLogFile', () => {
  describe('appendActivityEntry + readRecentActivityEntries', () => {
    it('round-trips a single appended entry', () => {
      appendActivityEntry(makeEntry(1), filePath);

      const read = readRecentActivityEntries(100, filePath);
      expect(read).toHaveLength(1);
      expect(read[0].message).toBe('entry-1');
    });

    it('is append-only — earlier entries are preserved across writes', () => {
      appendActivityEntry(makeEntry(1), filePath);
      appendActivityEntry(makeEntry(2), filePath);
      appendActivityEntry(makeEntry(3), filePath);

      const read = readRecentActivityEntries(100, filePath);
      expect(read.map((e) => e.message)).toEqual(['entry-1', 'entry-2', 'entry-3']);
    });

    it('returns at most `cap` entries, the most recent ones', () => {
      for (let i = 0; i < 10; i++) appendActivityEntry(makeEntry(i), filePath);

      const read = readRecentActivityEntries(3, filePath);
      expect(read.map((e) => e.message)).toEqual(['entry-7', 'entry-8', 'entry-9']);
    });

    it('returns all entries when fewer than `cap` exist', () => {
      appendActivityEntry(makeEntry(1), filePath);
      appendActivityEntry(makeEntry(2), filePath);

      expect(readRecentActivityEntries(100, filePath)).toHaveLength(2);
    });

    it('returns an empty array when the file does not exist', () => {
      expect(readRecentActivityEntries(100, filePath)).toEqual([]);
    });

    it('returns an empty array for an empty file', () => {
      fs.writeFileSync(filePath, '');
      expect(readRecentActivityEntries(100, filePath)).toEqual([]);
    });

    it('skips malformed/corrupt lines instead of throwing', () => {
      appendActivityEntry(makeEntry(1), filePath);
      fs.appendFileSync(filePath, 'this is not json\n');
      fs.appendFileSync(filePath, '{"partial":\n');
      appendActivityEntry(makeEntry(2), filePath);

      const read = readRecentActivityEntries(100, filePath);
      expect(read.map((e) => e.message)).toEqual(['entry-1', 'entry-2']);
    });
  });

  describe('trimActivityFile', () => {
    it('trims the file to the last `cap` entries', () => {
      for (let i = 0; i < 10; i++) appendActivityEntry(makeEntry(i), filePath);

      trimActivityFile(3, filePath);

      const read = readRecentActivityEntries(100, filePath);
      expect(read.map((e) => e.message)).toEqual(['entry-7', 'entry-8', 'entry-9']);
    });

    it('is a no-op when the file is already within the bound', () => {
      appendActivityEntry(makeEntry(1), filePath);
      appendActivityEntry(makeEntry(2), filePath);

      trimActivityFile(100, filePath);

      expect(readRecentActivityEntries(100, filePath)).toHaveLength(2);
    });

    it('does not throw when trimming a non-existent file', () => {
      expect(() => trimActivityFile(10, filePath)).not.toThrow();
    });
  });
});
