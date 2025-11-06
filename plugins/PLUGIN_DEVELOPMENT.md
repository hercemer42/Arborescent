# Plugin Development Guide

## Overview

Arborescent uses a VS Code-inspired plugin architecture that allows extending the application's functionality through well-defined extension points. Plugins can add context menu items, node indicators, sidebar panels, and toolbar actions.

## Current Architecture

**Process Isolation:** Plugins run in isolated worker threads (Node.js) for security and stability.

```
Renderer ←→ IPC ←→ Main Process ←→ Worker Thread
                                      ↓
                                   Plugin
                                      ↓
                            PluginContext (typed API)
                                      ↓
                              PluginIPCBridge
                                      ↓
                               IPC Handlers
```

**Key Points:**
- Plugins execute in isolated worker thread (no window, DOM, or React APIs)
- Use typed methods from `PluginContext` to access main process functionality
- Extension points return JSON-serializable data only
- Commands run in renderer process (have access to UI state)
- Plugin crashes don't affect the renderer

## Plugin Structure

A plugin is organized into the following structure:

```
plugins/my-plugin/
├── plugin.config.ts        # Plugin configuration (for auto-discovery)
├── manifest.json           # Plugin metadata (lazy loading)
├── main/
│   ├── MyPlugin.ts         # Plugin implementation (runs in worker)
│   ├── myPluginIpcHandlers.ts  # Main process IPC handlers (optional)
│   └── register.ts         # Entry point for IPC handler registration (optional)
└── renderer/
    ├── commands.ts         # Command handlers (renderer process)
    └── register.ts         # Entry point for command registration
```

**Key Files:**

- **plugin.config.ts** - Tells the build system and runtime where to find your plugin. Required for auto-discovery.
- **manifest.json** - Plugin metadata (name, version, description, etc.)
- **main/register.ts** - Exports `registerIpcHandlers()` function (optional, only if you have IPC handlers)
- **renderer/register.ts** - Exports `registerCommands()` function for command registration

**Lazy Loading:** Plugin code is loaded on-demand when first used, improving startup performance.

## Core Interfaces

### Plugin Interface

```typescript
interface Plugin {
  manifest: PluginManifest;
  extensionPoints: PluginExtensionPoints;
  initialize(): Promise<void>;
  dispose(): void;
}
```

### Plugin Manifest

```typescript
interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  enabled: boolean;
  builtin: boolean;
  main: string;       // Path to compiled plugin code (for lazy loading)
  apiVersion?: string;
}
```

**Example manifest.json:**
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "displayName": "My Plugin",
  "description": "Does something useful",
  "enabled": true,
  "builtin": true,
  "main": ".vite/build/plugins/my-plugin.cjs",
  "apiVersion": "1.0.0"
}
```

### Extension Points

Plugins extend functionality by implementing one or more extension points:

```typescript
interface PluginExtensionPoints {
  // Add items to node context menu
  provideNodeContextMenuItems?(
    node: TreeNode,
    context: NodeContext
  ): PluginContextMenuItem[] | Promise<PluginContextMenuItem[]>;

  // Add visual indicators to nodes
  provideNodeIndicator?(
    node: TreeNode
  ): PluginNodeIndicator | null | Promise<PluginNodeIndicator | null>;
}
```

## Extension Point Data Types

All extension points return **serializable data structures** (no functions). This design enables process isolation via worker threads.

### PluginContextMenuItem

Context menu items use a **command pattern** - they specify a command ID to execute, not an onClick handler.

```typescript
interface PluginContextMenuItem {
  id: string;                           // Command ID to execute
  label: string;                        // Display text
  disabled?: boolean;                   // Disabled state
  separator?: boolean;                  // Render as separator
  submenu?: PluginContextMenuItem[];    // Nested menu items
}
```

### PluginNodeIndicator

Visual indicators shown next to nodes:

```typescript
type PluginNodeIndicator =
  | { type: 'text'; value: string }     // Text indicator (e.g., "🤖")
  | { type: 'icon'; value: string };    // Icon indicator
```

## Command Pattern

Since extension points return serializable data, user actions are handled via the **command pattern**:

1. Extension point returns menu item with `id: 'my-plugin:my-command'`
2. Command handler is registered separately with `PluginCommandRegistry`
3. When user clicks menu item, command is executed

### Registering Commands

```typescript
// plugins/my-plugin/renderer/commands.ts
import { PluginCommandRegistry } from '../../core/PluginCommandRegistry';

export function registerMyPluginCommands(): void {
  PluginCommandRegistry.register(
    'my-plugin:my-command',
    async (context: CommandContext) => {
      const { node } = context;
      // Command logic here
      logger.info(`Executed command on node: ${node.id}`, 'My Plugin');
    }
  );
}
```

### Command Context

```typescript
interface CommandContext {
  node: TreeNode;  // The node the command was invoked on
}
```

## PluginContext API

The `PluginContext` class provides a **generic, secure API surface** for plugins to access main process functionality via IPC.

**Security Benefits:**
- Only registered IPC handlers are accessible to plugins
- Type-safe with TypeScript generics
- Plugin isolation prevents access to internal channels
- All communication goes through the secure PluginIPCBridge

**Available Methods:**

```typescript
class PluginContext {
  /**
   * Generic IPC invocation method that plugins can use to call main process handlers.
   * The handler must be registered via pluginIPCBridge.registerHandler() in the main process.
   *
   * @param channel - The IPC channel name (e.g., 'plugin-name:operation')
   * @param args - Arguments to pass to the handler
   * @returns Promise resolving to the handler's return value
   */
  async invokeIPC<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
}
```

**Usage Example:**

```typescript
export class MyPlugin implements Plugin {
  private context: PluginContext;
  private projectPath: string = '';

  constructor(context: PluginContext) {
    this.context = context;
  }

  async initialize(): Promise<void> {
    // Call any IPC handler registered by your plugin in the main process
    this.projectPath = await this.context.invokeIPC<string>('my-plugin:get-config');
    const data = await this.context.invokeIPC<MyData[]>('my-plugin:fetch-data', this.projectPath);
    logger.info(`Loaded ${data.length} items`, 'My Plugin');
  }
}
```

**Note:** Your plugin must register its IPC handlers in the main process before they can be called.
See the "IPC Communication" section below for details.

## Creating a Plugin

### Step 1: Create Plugin Directory Structure

```bash
mkdir -p plugins/my-plugin/renderer
mkdir -p plugins/my-plugin/main
```

### Step 2: Create Plugin Configuration

Create `plugins/my-plugin/plugin.config.ts`:

```typescript
import type { PluginConfig } from '../core/types/pluginConfig';

export const config: PluginConfig = {
  name: 'my-plugin',
  pluginPath: '.vite/build/plugins/my-plugin.cjs',
  manifestPath: 'plugins/my-plugin/manifest.json',
  mainRegisterPath: '../my-plugin/main/register',
  rendererRegisterPath: '../my-plugin/renderer/register',
};
```

**Note:** This configuration file enables automatic plugin discovery. The paths are:
- `pluginPath` - Where Vite builds your plugin
- `manifestPath` - Location of your manifest.json
- `mainRegisterPath` - Path to your main process registration (optional, omit if no IPC handlers)
- `rendererRegisterPath` - Path to your renderer command registration

### Step 3: Create Manifest

Create `plugins/my-plugin/manifest.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "displayName": "My Plugin",
  "description": "Does something useful",
  "enabled": true,
  "builtin": true,
  "main": ".vite/build/plugins/my-plugin.cjs",
  "apiVersion": "1.0.0"
}
```

**Note:** Always specify `apiVersion` matching the current plugin API (currently `1.0.0`). Plugins with incompatible API versions will be rejected at load time.

### Step 4: Define Plugin Class

**Note:** Plugin runs in worker thread - no window, document, or React APIs available.

```typescript
// plugins/my-plugin/main/MyPlugin.ts
import {
  Plugin,
  PluginManifest,
  PluginExtensionPoints,
  PluginContextMenuItem,
  NodeContext,
} from '../../core/pluginInterface';
import { PluginContext } from '../../core/main/pluginWorker/PluginContext';
import { TreeNode } from '../../../src/shared/types';
import manifest from '../manifest.json';
import { logger } from '../../core/main/pluginWorker/workerLogger';

export class MyPlugin implements Plugin {
  manifest: PluginManifest = manifest;
  private context: PluginContext;
  private someData: string = '';

  constructor(context: PluginContext) {
    this.context = context;
  }

  extensionPoints: PluginExtensionPoints = {
    provideNodeContextMenuItems: (node, context) => {
      return this.getContextMenuItems(node, context);
    },
  };

  async initialize(): Promise<void> {
    // Use typed methods from PluginContext
    // Example: const projectPath = await this.context.getProjectPath();
    logger.info('Initialized', 'My Plugin');
  }

  dispose(): void {
    logger.info('Disposed', 'My Plugin');
  }

  private getContextMenuItems(
    node: TreeNode,
    context: NodeContext
  ): PluginContextMenuItem[] {
    return [
      {
        id: 'my-plugin:my-command',
        label: 'My Action',
      },
    ];
  }
}

export default MyPlugin;
```

### Step 5: Create Command Registration

Create `plugins/my-plugin/renderer/commands.ts`:

```typescript
import { PluginCommandRegistry } from '../../core/PluginCommandRegistry';
import { logger } from '../../../src/renderer/services/logger';

export function registerMyPluginCommands(): void {
  PluginCommandRegistry.register('my-plugin:my-command', async (context) => {
    logger.info('My command executed!', 'My Plugin');
  });
}
```

Create `plugins/my-plugin/renderer/register.ts`:

```typescript
import { registerMyPluginCommands } from './commands';

export function registerCommands(): void {
  registerMyPluginCommands();
}
```

### Step 6: Create IPC Handler Registration (Optional)

**Only needed if your plugin has IPC handlers for main process operations.**

Create `plugins/my-plugin/main/myPluginIpcHandlers.ts`:

```typescript
import { pluginIPCBridge } from '../../core/main/PluginIPCBridge';

export function registerMyPluginIpcHandlers(): void {
  pluginIPCBridge.registerHandler('my-plugin:get-data', async () => {
    // Main process logic here
    return { data: 'example' };
  });
}
```

Create `plugins/my-plugin/main/register.ts`:

```typescript
import { registerMyPluginIpcHandlers } from './myPluginIpcHandlers';

export function registerIpcHandlers(): void {
  registerMyPluginIpcHandlers();
}
```

**If your plugin doesn't need IPC handlers**, omit the `mainRegisterPath` from your `plugin.config.ts`.

### Step 7: Build and Run

That's it! Your plugin is now ready. The system will automatically:

1. **Discover your plugin** via `plugin.config.ts`
2. **Build it** with Vite (no manual config changes needed)
3. **Load it** at runtime (no core modifications needed)

Run your dev server or build:

```bash
npm start       # Development mode
npm run build   # Production build
```

**Note:** Plugin code is lazy-loaded on first use. Only the manifest is read during registration for fast startup.

## How Plugin Discovery Works

The plugin system uses automatic discovery to eliminate manual configuration:

### Build Time (Vite)

`vite.main.config.ts` scans for all `plugin.config.ts` files:

```typescript
const pluginDirs = fs.readdirSync('plugins')
  .filter(dirent => dirent.isDirectory() && dirent.name !== 'core');

for (const pluginName of pluginDirs) {
  const configPath = path.join('plugins', pluginName, 'plugin.config.ts');
  if (fs.existsSync(configPath)) {
    // Auto-add to Vite build entries
  }
}
```

### Runtime (Application)

`plugins/plugins.config.ts` uses Vite's glob imports:

```typescript
const pluginConfigModules = import.meta.glob('./*/plugin.config.ts', { eager: true });

export const PLUGINS = Object.values(pluginConfigModules).map(
  (module) => module.config
);
```

This means:
- ✅ Add a plugin = create a `plugin.config.ts` file
- ✅ Remove a plugin = delete the plugin directory
- ✅ No core file modifications needed
- ✅ No build config changes needed

## Working with Node Context

Context menu items receive a `NodeContext` object with information about where the menu was opened:

```typescript
interface NodeContext {
  isMultiSelect: boolean;
  selectedNodes: TreeNode[];
}
```

Example usage:

```typescript
private getContextMenuItems(
  node: TreeNode,
  context: NodeContext
): PluginContextMenuItem[] {
  if (context.isMultiSelect) {
    return [
      {
        id: 'my-plugin:batch-action',
        label: `Process ${context.selectedNodes.length} nodes`,
      },
    ];
  }

  return [
    {
      id: 'my-plugin:single-action',
      label: 'Process single node',
    },
  ];
}
```

## IPC Communication

The plugin system uses a dedicated **PluginIPCBridge** to safely expose IPC handlers to plugin worker threads without relying on Electron's private APIs.

**How PluginContext and PluginIPCBridge relate:** PluginContext provides the high-level typed API that plugins use, while PluginIPCBridge is the underlying infrastructure that makes those API calls work. When you call a PluginContext method, it uses `invokeIPC()` internally to communicate through PluginIPCBridge to the main process.

**Note:** Plugins should use the typed methods from `PluginContext` (see PluginContext API section above) rather than calling IPC handlers directly. This section documents how to add new APIs to PluginContext if needed.

### Main Process Handler

Plugin IPC handlers are registered **only** through the `pluginIPCBridge`. This ensures all plugins (builtin and third-party) use the same secure communication mechanism:

```typescript
// plugins/my-plugin/main/myPluginIpcHandlers.ts
import { pluginIPCBridge } from '../../core/main/PluginIPCBridge';

export function registerMyPluginIpcHandlers(): void {
  // Define handler (use rest parameters for pluginIPCBridge compatibility)
  const doSomethingHandler = async (_: unknown, ...args: unknown[]) => {
    const arg = args[0] as string;
    // Main process logic using Node.js/Electron APIs
    return { success: true };
  };

  // Register with pluginIPCBridge for plugin worker threads
  pluginIPCBridge.registerHandler('my-plugin:do-something', doSomethingHandler);
}
```

**Why PluginIPCBridge?**
- **No private API access**: Doesn't rely on Electron's internal `_invokeHandlers` (fragile, could break on upgrades)
- **Type-safe**: Explicit handler registry with proper TypeScript types
- **Security**: Only explicitly registered handlers are accessible to plugins
- **Control**: Can add middleware, validation, rate limiting, etc.
- **Consistency**: All plugins use the same communication mechanism

**Note:** The `pluginIPCBridge` provides a controlled API surface for plugin communication, ensuring plugins can only access explicitly approved functionality.

### Adding to PluginContext API

After registering IPC handlers, add a typed method to `PluginContext`:

```typescript
// plugins/core/main/pluginWorker/PluginContext.ts
export class PluginContext {
  // ... existing methods

  async doSomething(arg: string): Promise<{ success: boolean }> {
    return this.invokeIPC<{ success: boolean }>('my-plugin:do-something', arg);
  }
}
```

Then plugins can use the typed method:

```typescript
// In plugin
async initialize(): Promise<void> {
  const result = await this.context.doSomething('hello');
  logger.info(`Result: ${result.success}`, 'My Plugin');
}
```

## Accessing Node Metadata

Nodes have rich metadata you can use in your plugins:

```typescript
interface TreeNode {
  id: string;
  content: string;
  metadata: {
    status: 'backlog' | 'active' | 'completed' | 'cancelled';
    createdAt: number;
    modifiedAt: number;
  };
  // ... other fields
}
```

Example:

```typescript
PluginCommandRegistry.register('my-plugin:check-status', async (context) => {
  const { node } = context;

  if (node.metadata.status === 'completed') {
    logger.info('Node is already completed', 'My Plugin');
    return;
  }

  // Process node...
});
```

## Node Indicators

Add visual indicators to nodes based on their state:

```typescript
private getNodeIndicator(node: TreeNode): PluginNodeIndicator | null {
  // Check custom metadata
  const hasAIContext = node.metadata.customData?.aiContext;

  if (hasAIContext) {
    return { type: 'text', value: '🤖' };
  }

  return null;
}
```

## Plugin Lifecycle

Plugins follow a clear lifecycle with lazy loading:

1. **Registration** - Only manifest.json is read, plugin code not loaded yet
2. **First Use** - Plugin code is lazy-loaded when extension point is called
3. **Construction** - Plugin class is instantiated
4. **Initialization** - `initialize()` is called automatically
5. **Active** - Extension points are invoked as needed
6. **Disposal** - `dispose()` is called on shutdown

```typescript
export class MyPlugin implements Plugin {
  async initialize(): Promise<void> {
    // Setup: subscribe to stores, initialize state, etc.
    // This runs only on first use, not at startup
    logger.info('Plugin starting...', 'My Plugin');
  }

  dispose(): void {
    // Cleanup: unsubscribe, clear timers, etc.
    logger.info('Plugin stopping...', 'My Plugin');
  }
}
```

### Lazy Loading Benefits

- **Fast Startup**: Only manifest files are loaded at startup
- **Memory Efficient**: Plugin code loaded only when needed
- **Auto-Initialize**: Plugins initialize automatically on first use
- **Cached**: Once loaded, plugins stay in memory for subsequent calls

## Testing Plugins

Test your plugin extension points:

```typescript
// plugins/my-plugin/renderer/tests/MyPlugin.test.ts
import { describe, it, expect } from 'vitest';
import { MyPlugin } from '../MyPlugin';

describe('MyPlugin', () => {
  it('should provide context menu items', () => {
    const plugin = new MyPlugin();
    const node = createMockNode();
    const context = { isMultiSelect: false, selectedNodes: [node] };

    const items = plugin.extensionPoints.provideNodeContextMenuItems?.(node, context);

    expect(items).toHaveLength(1);
    expect(items?.[0].id).toBe('my-plugin:my-command');
  });

  it('should show indicator for special nodes', () => {
    const plugin = new MyPlugin();
    const node = createMockNode({ customData: { aiContext: true } });

    const indicator = plugin.extensionPoints.provideNodeIndicator?.(node);

    expect(indicator).toEqual({ type: 'text', value: '🤖' });
  });
});
```

## Best Practices

1. **Command Naming**: Use plugin name as prefix (`my-plugin:command-name`)
2. **Error Handling**: Wrap async operations in try-catch, log errors
3. **Serializable Data**: Extension points must return JSON-serializable objects
4. **Performance**: Keep extension point methods fast - they're called frequently
5. **Cleanup**: Always implement `dispose()` to clean up resources
6. **TypeScript**: Use strict typing for all plugin code

## Example: ClaudeCodePlugin

See `plugins/claude-code/` for a complete working example of a builtin plugin that:
- Runs in isolated worker thread
- Uses `context.invokeIPC()` to communicate with main process (generic API)
- Adds context menu items for sending nodes to Claude Code sessions
- Shows AI indicators on nodes with session metadata
- Registers multiple commands in renderer

Key files:
- `plugins/claude-code/plugin.config.ts` - Plugin configuration (enables auto-discovery)
- `plugins/claude-code/manifest.json` - Plugin metadata
- `plugins/claude-code/main/ClaudeCodePlugin.ts` - Plugin implementation (runs in worker)
- `plugins/claude-code/main/claudeCodeIpcHandlers.ts` - IPC handler registration (main process)
- `plugins/claude-code/main/register.ts` - Main process entry point
- `plugins/claude-code/renderer/claudeCodeCommands.ts` - Command registration (renderer process)
- `plugins/claude-code/renderer/register.ts` - Renderer process entry point

**Architecture Notes:**
- The plugin uses the generic `PluginContext.invokeIPC()` method to call main process handlers
- IPC handlers are registered via `pluginIPCBridge.registerHandler()` before plugin initialization
- No plugin-specific preload layer needed - all communication goes through the generic plugin IPC bridge
- Plugin is automatically discovered via `plugin.config.ts` - no core modifications needed

## Process Isolation Details

The plugin worker architecture provides:

**Worker Thread:**
- `pluginWorker.worker.ts` - Loads and executes plugins
- `PluginAPI` - Low-level IPC communication with main process
- `PluginContext` - Typed API surface injected into plugins, provides secure methods
- `workerLogger.ts` - Logging from worker to main

**Main Process:**
- `PluginWorkerConnection.ts` - Manages worker lifecycle
- `pluginIpcHandlers.ts` - Handles renderer ↔ worker communication
- `PluginIPCBridge.ts` - Secure registry for plugin-accessible IPC handlers
- Forwards pluginAPI calls to PluginIPCBridge (no private API access)

**Renderer Process:**
- `PluginProxy.ts` - Proxies calls to worker via IPC
- `PluginManager.ts` - IPC coordination, creates PluginProxy instances
- `PluginRegistry.ts` - Tracks enabled plugins, updates UI state
- `PluginCommandRegistry.ts` - Executes commands with renderer access

**Benefits:**
- Plugin crashes isolated from renderer
- No direct DOM/React access from plugins
- Security: Untrusted code runs in sandbox
- Performance: Heavy operations don't block UI

### Security Architecture

The plugin system is secure by design through process isolation:

**What plugins CAN access:**
- `PluginContext` API (only `invokeIPC()` method)
- IPC handlers explicitly registered via `pluginIPCBridge.registerHandler()`
- Node.js standard library (fs, path, etc.)
- npm packages they declare as dependencies

**What plugins CANNOT access:**
- Electron main process APIs (`ipcMain`, `BrowserWindow`, `app`, etc.)
  - These are `undefined` in worker threads even if imported
- Direct access to the renderer process or DOM
- Other plugins' internal state
- Application's internal IPC channels

**Why it's secure:**
Plugins run in Node.js worker threads, which are completely isolated from Electron's main process. Even if a plugin attempts `require('electron').ipcMain`, it receives `undefined` because Electron's main process APIs don't exist in worker context. The only way for plugins to communicate is through the controlled `PluginContext.invokeIPC()` method, which only accesses handlers explicitly registered in `PluginIPCBridge`.

## API Versioning

Arborescent uses semantic versioning for the plugin API to ensure compatibility between plugins and the core system.

**Current API Version:** `1.0.0`

### Version Format

Follows semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Incompatible API changes (breaking changes)
- **MINOR**: Backward-compatible new features
- **PATCH**: Backward-compatible bug fixes

### Compatibility Rules

- **No `apiVersion` specified**: Plugin is assumed compatible (backward compatibility for v1.0.0)
- **Same major version**: Plugin is compatible (e.g., 1.0.0 works with 1.2.5)
- **Different major version**: Plugin is **rejected** at load time

### Example

```json
{
  "name": "my-plugin",
  "apiVersion": "1.0.0"
}
```

If the plugin system upgrades to API v2.0.0 (breaking changes), this plugin will be rejected with an error toast:
```
Plugin "My Plugin": Incompatible API version: plugin requires v1.0.0, but current API is v2.0.0
```

### Best Practices

1. **Always specify `apiVersion`** in your manifest
2. **Match the current API version** when developing new plugins
3. **Test your plugin** after API updates to ensure compatibility
4. **Update `apiVersion`** when rebuilding plugins for new API versions
