import { describe, it, expect, vi } from 'vitest';

import { resumeAllRestoredSessions } from '../launchSessionResume';
import { logger } from '../logger';

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Every test injects deps, so the real default wiring is never exercised — stub
// the store graph it imports to keep this unit isolated.
vi.mock('../../store/storeManager', () => ({ storeManager: { getStoreForFile: vi.fn() } }));
vi.mock('../../store/terminal/terminalStore', () => ({
  useTerminalStore: { getState: () => ({ materializeAllRestoredTerminals: vi.fn() }) },
}));

type Target = { filePath: string; terminalId: string; sessionId: string };

describe('resumeAllRestoredSessions — launch fan-out orchestration', () => {
  it('materializes once then resumes every target through its own file', async () => {
    const targets: Target[] = [
      { filePath: '/a.arbo', terminalId: 'ta', sessionId: 'sa' },
      { filePath: '/b.arbo', terminalId: 'tb', sessionId: 'sb' },
    ];
    const materializeAll = vi.fn().mockResolvedValue(targets);
    const resumeForFile = vi.fn().mockResolvedValue(undefined);

    await resumeAllRestoredSessions({ materializeAll, resumeForFile });

    expect(materializeAll).toHaveBeenCalledTimes(1);
    expect(resumeForFile).toHaveBeenCalledTimes(2);
    expect(resumeForFile).toHaveBeenCalledWith('/a.arbo', 'ta', 'sa');
    expect(resumeForFile).toHaveBeenCalledWith('/b.arbo', 'tb', 'sb');
  });

  it('does nothing when there are no resume targets', async () => {
    const resumeForFile = vi.fn();
    await resumeAllRestoredSessions({ materializeAll: vi.fn().mockResolvedValue([]), resumeForFile });
    expect(resumeForFile).not.toHaveBeenCalled();
  });

  it('continues resuming the rest when one resume fails, and never throws', async () => {
    const targets: Target[] = [
      { filePath: '/a.arbo', terminalId: 'ta', sessionId: 'sa' },
      { filePath: '/b.arbo', terminalId: 'tb', sessionId: 'sb' },
    ];
    const resumeForFile = vi.fn().mockImplementation((filePath: string) =>
      filePath === '/a.arbo' ? Promise.reject(new Error('boom')) : Promise.resolve(),
    );

    await expect(
      resumeAllRestoredSessions({ materializeAll: vi.fn().mockResolvedValue(targets), resumeForFile, concurrency: 1 }),
    ).resolves.toBeUndefined();
    expect(resumeForFile).toHaveBeenCalledTimes(2);
    // The failure is logged quietly per-terminal (no toast, no storm) and does not abort the rest.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ta'), 'App');
  });

  it('throttles concurrent resumes to the configured limit', async () => {
    const targets: Target[] = Array.from({ length: 6 }, (_, i) => ({
      filePath: `/f${i}.arbo`, terminalId: `t${i}`, sessionId: `s${i}`,
    }));
    const release: Array<() => void> = [];
    const gates = targets.map(() => new Promise<void>((resolve) => release.push(resolve)));

    let active = 0;
    let maxActive = 0;
    const resumeForFile = vi.fn().mockImplementation((_filePath: string, terminalId: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const index = Number(terminalId.slice(1));
      return gates[index].then(() => { active -= 1; });
    });

    const run = resumeAllRestoredSessions({ materializeAll: vi.fn().mockResolvedValue(targets), resumeForFile, concurrency: 2 });
    await Promise.resolve();
    expect(active).toBe(2);

    release.forEach((resolve) => resolve());
    await run;

    expect(maxActive).toBe(2);
    expect(resumeForFile).toHaveBeenCalledTimes(6);
  });

  it('does not throw when materialization fails', async () => {
    const resumeForFile = vi.fn();
    await expect(
      resumeAllRestoredSessions({ materializeAll: vi.fn().mockRejectedValue(new Error('disk')), resumeForFile }),
    ).resolves.toBeUndefined();
    expect(resumeForFile).not.toHaveBeenCalled();
  });
});
