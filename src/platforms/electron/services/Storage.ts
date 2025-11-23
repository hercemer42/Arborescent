import * as yaml from 'js-yaml';
import { ArboFile } from '../../../shared/types';
import { StorageService as IStorageService, SessionState, BrowserSession, PanelSession, ReviewSession } from '../../../shared/interfaces';
import { getNextUntitledNumber } from '../../../shared/utils/fileNaming';

export class Storage implements IStorageService {
  async loadDocument(filePath: string): Promise<ArboFile> {
    const content = await window.electron.readFile(filePath);
    const data = yaml.load(content) as ArboFile;

    if (data.format !== 'Arborescent') {
      throw new Error('Invalid file format');
    }

    return data;
  }

  async saveDocument(filePath: string, data: ArboFile): Promise<void> {
    const yamlContent = yaml.dump(data, { indent: 2, lineWidth: -1 });
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
    if (!sessionData) return null;
    try {
      return JSON.parse(sessionData) as SessionState;
    } catch {
      return null;
    }
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
    if (!metadata) return [];
    try {
      return JSON.parse(metadata) as string[];
    } catch {
      return [];
    }
  }

  async isTempFile(filePath: string): Promise<boolean> {
    const tempFiles = await this.getTempFiles();
    return tempFiles.includes(filePath);
  }

  async showUnsavedChangesDialog(fileName: string): Promise<number> {
    return window.electron.showUnsavedChangesDialog(fileName);
  }

  async saveBrowserSession(session: BrowserSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.saveBrowserSession(sessionData);
  }

  async getBrowserSession(): Promise<BrowserSession | null> {
    const sessionData = await window.electron.getBrowserSession();
    if (!sessionData) return null;
    try {
      return JSON.parse(sessionData) as BrowserSession;
    } catch {
      return null;
    }
  }

  async savePanelSession(session: PanelSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.savePanelSession(sessionData);
  }

  async getPanelSession(): Promise<PanelSession | null> {
    const sessionData = await window.electron.getPanelSession();
    if (!sessionData) return null;
    try {
      return JSON.parse(sessionData) as PanelSession;
    } catch {
      return null;
    }
  }

  async saveReviewSession(session: ReviewSession): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.saveReviewSession(sessionData);
  }

  async getReviewSession(): Promise<ReviewSession | null> {
    const sessionData = await window.electron.getReviewSession();
    if (!sessionData) return null;
    try {
      return JSON.parse(sessionData) as ReviewSession;
    } catch {
      return null;
    }
  }
}
