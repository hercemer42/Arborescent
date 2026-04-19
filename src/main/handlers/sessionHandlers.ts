import { ipcMain } from 'electron';
import { saveJsonFile, loadJsonFile } from '../services/persistenceService';

interface SessionSpec {
  channelSuffix: string;
  file: string;
  label: string;
}

// Each spec wires two IPC channels: `save-<channelSuffix>` and
// `get-<channelSuffix>`. Keep the suffix aligned with existing
// preload/global.d.ts channel names — it's a wire contract.
const SESSIONS: SessionSpec[] = [
  { channelSuffix: 'session', file: 'session.json', label: 'Session' },
  { channelSuffix: 'browser-session', file: 'browser-session.json', label: 'Browser session' },
  { channelSuffix: 'panel-session', file: 'panel-session.json', label: 'Panel session' },
  { channelSuffix: 'terminal-session', file: 'terminal-session.json', label: 'Terminal session' },
  { channelSuffix: 'temp-files-metadata', file: 'temp-files-metadata.json', label: 'Temp files metadata' },
];

export function registerSessionHandlers(): void {
  for (const { channelSuffix, file, label } of SESSIONS) {
    ipcMain.handle(`save-${channelSuffix}`, async (_, data: string) => {
      await saveJsonFile(file, data, label);
    });
    ipcMain.handle(`get-${channelSuffix}`, async () => {
      return await loadJsonFile(file, label);
    });
  }
}
