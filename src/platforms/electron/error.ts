import { ErrorService } from '../../shared/interfaces';

export class ElectronErrorService implements ErrorService {
  onError(callback: (message: string) => void): void {
    window.electron.setMainErrorHandler(callback);
  }
}
