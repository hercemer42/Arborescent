import { registerPluginIpcHandlers } from './pluginIpcHandlers';
import { registerBuiltinPluginHandlers } from './registerBuiltinPluginHandlers';

export async function registerPluginHandlers(): Promise<void> {
  registerPluginIpcHandlers();
  await registerBuiltinPluginHandlers();
}
