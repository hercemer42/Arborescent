import { powerSaveBlocker } from 'electron';

interface KeepAwakeApi {
  start: () => void;
  stop: () => void;
}

export function createKeepAwake(): KeepAwakeApi {
  let outstanding = 0;
  let blockerId: number | null = null;

  function start(): void {
    outstanding += 1;
    if (outstanding === 1) {
      blockerId = powerSaveBlocker.start('prevent-app-suspension');
    }
  }

  function stop(): void {
    if (outstanding === 0) return;
    outstanding -= 1;
    if (outstanding === 0 && blockerId !== null) {
      powerSaveBlocker.stop(blockerId);
      blockerId = null;
    }
  }

  return { start, stop };
}

const keepAwake = createKeepAwake();
export const startKeepAwake = keepAwake.start;
export const stopKeepAwake = keepAwake.stop;
