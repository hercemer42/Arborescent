import { ErrorService as IErrorService } from '../../../shared/interfaces';

export class ErrorHandler implements IErrorService {
  onError(callback: (message: string) => void): void {
    window.electron.setMainErrorHandler(callback);
  }
}
