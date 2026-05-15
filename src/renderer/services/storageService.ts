import * as yaml from 'js-yaml';
import { ArboFile } from '../../shared/types';
import { StorageService as IStorageService, SessionState, BrowserSession, TerminalSession, PanelSession, UserPreferences } from '../../shared/interfaces';
import {
  SessionStateSchema,
  BrowserSessionSchema,
  TerminalSessionSchema,
  PanelSessionSchema,
  UserPreferencesSchema,
  TempFilesMetadataSchema,
  parseOrNull,
} from '../../shared/schemas';
import { getNextUntitledNumber } from '../../shared/utils/fileNaming';
import { reconcileDuplicateChildren } from '../utils/treeInvariants';
import { migrateExternalLinkNodes } from '../utils/migrateExternalLinkNodes';
import { migrateContextModeFlags } from '../utils/migrateContextModeFlags';
import { migrateWorkflowStepIcons } from '../utils/migrateWorkflowStepIcons';
import { stripDroppedSessionFields, garbageCollectSessionRegistry } from '../utils/sessionRegistryMigrations';
import { logger } from './logger';

function logParseFailure(context: string) {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Discarding malformed ${context}: ${message}`, 'StorageService');
  };
}

export class StorageService implements IStorageService {
  async loadDocument(filePath: string): Promise<ArboFile> {
    const content = await window.electron.readFile(filePath);
    const data = yaml.load(content) as ArboFile;

    if (data.format !== 'Arborescent') {
      throw new Error('Invalid file format');
    }

    const { nodes, removed } = reconcileDuplicateChildren(data.nodes);
    const externalLinkMigrated = migrateExternalLinkNodes(nodes);
    const contextModeMigrated = migrateContextModeFlags(externalLinkMigrated);
    const workflowStepIconMigrated = migrateWorkflowStepIcons(contextModeMigrated);
    const strippedNodes = stripDroppedSessionFields(workflowStepIconMigrated);
    const rawRegistry = data.sessionRegistry ?? {};
    const sessionRegistry = garbageCollectSessionRegistry(strippedNodes, rawRegistry);

    if (removed.length > 0) {
      logger.warn(
        `Reconciled ${removed.length} duplicate child reference(s) while loading ${filePath}: ${JSON.stringify(removed)}`,
        'StorageService',
      );
    }

    const nodesChanged = strippedNodes !== nodes || removed.length > 0;
    const registryChanged = sessionRegistry !== rawRegistry;

    if (nodesChanged || registryChanged) {
      return {
        ...data,
        nodes: strippedNodes,
        sessionRegistry: Object.keys(sessionRegistry).length > 0 ? sessionRegistry : undefined,
      };
    }

    return data;
  }

  async saveDocument(filePath: string, data: ArboFile): Promise<void> {
    const strippedNodes = stripDroppedSessionFields(data.nodes);
    const cleanedData = strippedNodes !== data.nodes
      ? { ...data, nodes: strippedNodes }
      : data;
    const yamlContent = yaml.dump(cleanedData, { indent: 2, lineWidth: -1 });
    await window.electron.writeFile(filePath, yamlContent);
  }

  async showOpenDialog(): Promise<string | null> {
    return window.electron.showOpenDialog();
  }

  async showSaveDialog(defaultPath?: string): Promise<string | null> {
    return window.electron.showSaveDialog(defaultPath);
  }

  async saveSession(session: SessionState): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.saveSession(sessionData);
  }

  async getSession(): Promise<SessionState | null> {
    const sessionData = await window.electron.getSession();
    return parseOrNull(SessionStateSchema, sessionData, logParseFailure('session'));
  }

  async createTempFile(data: ArboFile): Promise<string> {
    const tempFiles = await this.getTempFiles();
    const nextNumber = getNextUntitledNumber(tempFiles);
    const fileName = `untitled-${nextNumber}.arbo`;
    const content = yaml.dump(data, { indent: 2, lineWidth: -1 });
    const filePath = await window.electron.createTempFile(fileName, content);

    tempFiles.push(filePath);
    await window.electron.saveTempFilesMetadata(JSON.stringify(tempFiles));

    return filePath;
  }

  async deleteTempFile(filePath: string): Promise<void> {
    await window.electron.deleteTempFile(filePath);

    const tempFiles = await this.getTempFiles();
    const updatedFiles = tempFiles.filter(f => f !== filePath);
    await window.electron.saveTempFilesMetadata(JSON.stringify(updatedFiles));
  }

  async getTempFiles(): Promise<string[]> {
    const metadata = await window.electron.getTempFilesMetadata();
    return parseOrNull(TempFilesMetadataSchema, metadata, logParseFailure('temp files metadata')) ?? [];
  }

  async isTempFile(filePath: string): Promise<boolean> {
    const tempFiles = await this.getTempFiles();
    return tempFiles.includes(filePath);
  }

  async showUnsavedChangesDialog(fileName: string): Promise<number> {
    return window.electron.showUnsavedChangesDialog(fileName);
  }

  async showRunningWorkflowDialog(fileName: string): Promise<boolean> {
    return window.electron.showRunningWorkflowDialog(fileName);
  }

  async showActiveSessionDialog(fileName: string): Promise<boolean> {
    return window.electron.showActiveSessionDialog(fileName);
  }

  async saveTerminalSession(session: TerminalSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.saveTerminalSession(sessionData);
  }

  async getTerminalSession(): Promise<TerminalSession | null> {
    const sessionData = await window.electron.getTerminalSession();
    return parseOrNull(TerminalSessionSchema, sessionData, logParseFailure('terminal session'));
  }

  async saveBrowserSession(session: BrowserSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.saveBrowserSession(sessionData);
  }

  async getBrowserSession(): Promise<BrowserSession | null> {
    const sessionData = await window.electron.getBrowserSession();
    return parseOrNull(BrowserSessionSchema, sessionData, logParseFailure('browser session'));
  }

  async savePanelSession(session: PanelSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.savePanelSession(sessionData);
  }

  async getPanelSession(): Promise<PanelSession | null> {
    const sessionData = await window.electron.getPanelSession();
    return parseOrNull(PanelSessionSchema, sessionData, logParseFailure('panel session'));
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    const preferencesData = JSON.stringify(preferences, null, 2);
    await window.electron.savePreferences(preferencesData);
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const preferencesData = await window.electron.getPreferences();
    return parseOrNull(UserPreferencesSchema, preferencesData, logParseFailure('user preferences'));
  }
}
