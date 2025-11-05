import { randomUUID } from 'node:crypto';

export function generateMessageId(prefix?: string): string {
  const uuid = randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
