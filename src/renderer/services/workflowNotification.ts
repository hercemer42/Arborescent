import { usePreferencesStore } from '../store/preferences/preferencesStore';
import { logger } from './logger';
import successSoundUrl from '../sounds/success.wav';
import alertSoundUrl from '../sounds/alert.wav';

export type NotificationEventType = 'success' | 'alert';

export async function notifyWorkflowEvent(type: NotificationEventType, title: string, body: string): Promise<void> {
  try {
    const focused = await window.electron.isWindowFocused();
    logger.info(`Notification requested: "${title}" — focused=${focused}`, 'WorkflowNotification');
    if (focused) return;

    const { desktopNotifications, notificationSounds } = usePreferencesStore.getState();
    logger.info(`Preferences: desktopNotifications=${desktopNotifications}, notificationSounds=${notificationSounds}`, 'WorkflowNotification');

    if (desktopNotifications) {
      logger.info(`Dispatching showNotification IPC: "${title}"`, 'WorkflowNotification');
      window.electron.showNotification(title, body).catch((error) => {
        logger.warn(`Failed to show notification: ${(error as Error).message}`, 'WorkflowNotification');
      });
    } else {
      logger.info(`Skipping notification: desktopNotifications preference is off`, 'WorkflowNotification');
    }

    if (notificationSounds) {
      playSound(type);
    }
  } catch (error) {
    logger.warn(`Notification dispatch failed: ${(error as Error).message}`, 'WorkflowNotification');
  }
}

function playSound(type: NotificationEventType): void {
  const soundUrl = type === 'success' ? successSoundUrl : alertSoundUrl;
  try {
    const audio = new Audio(soundUrl);
    audio.play().catch((error) => {
      logger.warn(`Failed to play ${type} sound: ${(error as Error).message}`, 'WorkflowNotification');
    });
  } catch (error) {
    logger.warn(`Failed to create audio for ${type} sound: ${(error as Error).message}`, 'WorkflowNotification');
  }
}
