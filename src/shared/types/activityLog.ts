export type ActivityLogSeverity = 'error' | 'warning' | 'success' | 'info';

export interface ActivityLogEntry {
  id: string;
  message: string;
  type: ActivityLogSeverity;
  source?: string;
  timestamp: number;
}

export const MAX_ACTIVITY_ENTRIES = 100;
