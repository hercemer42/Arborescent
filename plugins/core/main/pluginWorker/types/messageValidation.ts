import { z } from 'zod';
import { MessageType } from './messages';

export const RegisterPluginPayloadSchema = z.object({
  pluginName: z.string(),
  pluginPath: z.string(),
  manifestPath: z.string(),
});

export const UnregisterPluginPayloadSchema = z.object({
  pluginName: z.string(),
});

export const InvokeExtensionPayloadSchema = z.object({
  pluginName: z.string(),
  extensionPoint: z.string(),
  args: z.array(z.unknown()),
});

export const ResponsePayloadSchema = z.object({
  success: z.boolean().optional(),
  result: z.unknown().optional(),
  manifest: z.unknown().optional(),
});

export const ErrorPayloadSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
});

export const PluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  builtin: z.boolean(),
  main: z.string(),
});

export const BaseMessageSchema = z.object({
  type: z.nativeEnum(MessageType),
  id: z.string(),
  payload: z.unknown(),
});

export const RendererMessageSchema = z.object({
  type: z.enum([
    MessageType.RegisterPlugin,
    MessageType.UnregisterPlugin,
    MessageType.InitializePlugins,
    MessageType.DisposePlugins,
    MessageType.InvokeExtension,
  ]),
  id: z.string(),
  payload: z.unknown(),
});

export const ExtensionHostMessageSchema = z.object({
  type: z.enum([
    MessageType.Response,
    MessageType.Error,
    MessageType.Ready,
    MessageType.StoreUpdate,
  ]),
  id: z.string(),
  payload: z.unknown(),
});

export const IPCCallMessageSchema = z.object({
  type: z.literal('ipc-call'),
  id: z.string(),
  channel: z.string(),
  args: z.array(z.unknown()),
});

export const IPCResponseMessageSchema = z.object({
  type: z.literal('ipc-response'),
  id: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const LogMessageSchema = z.object({
  type: z.literal('log'),
  level: z.enum(['error', 'warn', 'info']),
  message: z.string(),
  context: z.string().optional(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),
});

export type RegisterPluginPayload = z.infer<typeof RegisterPluginPayloadSchema>;
export type UnregisterPluginPayload = z.infer<typeof UnregisterPluginPayloadSchema>;
export type InvokeExtensionPayload = z.infer<typeof InvokeExtensionPayloadSchema>;
export type ResponsePayload = z.infer<typeof ResponsePayloadSchema>;
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type IPCCallMessage = z.infer<typeof IPCCallMessageSchema>;
export type IPCResponseMessage = z.infer<typeof IPCResponseMessageSchema>;
export type LogMessage = z.infer<typeof LogMessageSchema>;

export function validatePayload<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeValidatePayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
