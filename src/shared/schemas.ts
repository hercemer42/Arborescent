import { z } from 'zod';

/**
 * Zod schemas for every value that crosses the IPC boundary as a JSON
 * blob: session state, browser/terminal/panel persisted layouts, and
 * user preferences.
 *
 * Use:  SessionStateSchema.parse(JSON.parse(raw))
 *   or: parseOrNull(SessionStateSchema, raw) — returns null on any
 *       parse/validation failure, matching the existing storageService
 *       semantics (don't throw at the boundary; treat malformed state
 *       as "no session").
 *
 * Keep these in lockstep with the interfaces declared in
 * shared/interfaces.ts. The TS-type-from-schema inference (z.infer)
 * means if a schema drifts from the interface, consumers fail to type-
 * check.
 */

const ThemeSchema = z.enum(['light', 'dark']);

const HotkeyMapSchema = z.record(z.string(), z.record(z.string(), z.string()));

export const UserPreferencesSchema = z.object({
  theme: ThemeSchema,
  hotkeys: HotkeyMapSchema.optional(),
  hasSeenWorkflowDeclarationToast: z.boolean().optional(),
  hasReceivedHookEvent: z.boolean().optional(),
  hasLaunchedWorkflow: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),
  notificationSounds: z.boolean().optional(),
});

export const SessionStateSchema = z.object({
  openFiles: z.array(z.string()),
  activeFilePath: z.string().nullable(),
});

const BrowserTabSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
});

const BrowserFileStateSchema = z.object({
  tabs: z.array(BrowserTabSchema),
  activeTabId: z.string().nullable(),
});

export const BrowserSessionSchema = z.object({
  tabs: z.array(BrowserTabSchema),
  activeTabId: z.string().nullable(),
  fileStates: z.record(z.string(), BrowserFileStateSchema).optional(),
});

const TerminalSessionEntrySchema = z.object({
  title: z.string(),
  cwd: z.string(),
  originNodeId: z.string().optional(),
  sessionId: z.string().optional(),
});

const TerminalFileStateSchema = z.object({
  terminals: z.array(TerminalSessionEntrySchema),
  activeTerminalIndex: z.number().nullable(),
});

export const TerminalSessionSchema = z.object({
  fileStates: z.record(z.string(), TerminalFileStateSchema),
});

const PanelContentSchema = z.enum(['terminal', 'browser', 'feedback']).nullable();

const PanelFileStateSchema = z.object({
  activeContent: PanelContentSchema,
  previousContent: PanelContentSchema,
});

export const PanelSessionSchema = z.object({
  panelPosition: z.enum(['side', 'bottom']),
  panelHeight: z.number(),
  panelWidth: z.number(),
  activeContent: PanelContentSchema,
  fileStates: z.record(z.string(), PanelFileStateSchema).optional(),
});

export const TempFilesMetadataSchema = z.array(z.string());

/**
 * Run a JSON string through JSON.parse + schema validation. Returns the
 * parsed value on success; returns null and logs the failure via
 * onParseFailure for any JSON-syntax or schema-validation failure. This
 * preserves the existing storageService "treat corrupted session state
 * as missing session state" behavior while giving us a single point
 * that logs exactly which field failed.
 */
export function parseOrNull<T>(
  schema: z.ZodType<T>,
  raw: string | null | undefined,
  onParseFailure?: (error: unknown) => void,
): T | null {
  if (!raw) return null;
  let unparsed: unknown;
  try {
    unparsed = JSON.parse(raw);
  } catch (error) {
    onParseFailure?.(error);
    return null;
  }
  const result = schema.safeParse(unparsed);
  if (!result.success) {
    onParseFailure?.(result.error);
    return null;
  }
  return result.data;
}
