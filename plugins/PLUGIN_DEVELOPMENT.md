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

A plugin is organized into three main directories:

```
plugins/my-plugin/
├── manifest.json           # Plugin metadata (lazy loading)
├── main/
│   ├── MyPlugin.ts         # Plugin implementation (runs in worker)
│   └── myPluginIpcHandlers.ts  # Main process IPC handlers
├── preload/
│   └── myPluginPreload.ts  # IPC bridge
└── renderer/
    └── commands.ts         # Command handlers (renderer process)
```

**Lazy Loading:** Plugin code is loaded on-demand when first used, improving startup performance.

## Core Interfaces

### Plugin Interface

```typescript
interface Plugin {
  manifest: PluginManifest;
  extensions: PluginExtensionPoints;
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

All extension points return **serializable data structures** (no functions). This design enables future process isolation via worker threads.

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

The `PluginContext` class provides a **typed, secure API surface** for plugins to access main process functionality. This replaces the previous open `invokeIPC()` method, which allowed plugins to call any IPC channel.

**Security Benefits:**
- Only approved APIs are exposed to plugins
- Type-safe with full TypeScript autocomplete
- Clear documentation of available capabilities
- Prevents plugins from accessing internal IPC channels

**Available Methods:**

```typescript
class PluginContext {
  // Get the current project's file path
  async getProjectPath(): Promise<string>

  // List Claude Code sessions for a project
  async listClaudeSessions(projectPath: string): Promise<ClaudeCodeSession[]>

  // Send context to a Claude Code session
  async sendToClaudeSession(
    sessionId: string,
    context: string,
    projectPath: string
  ): Promise<void>
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
    // Use typed methods with full autocomplete
    this.projectPath = await this.context.getProjectPath();
    const sessions = await this.context.listClaudeSessions(this.projectPath);
    logger.info(`Found ${sessions.length} sessions`, 'My Plugin');
  }
}
```

## Creating a Plugin

### Step 1: Create Plugin Directory Structure

```bash
mkdir -p plugins/my-plugin/renderer
mkdir -p plugins/my-plugin/main
mkdir -p plugins/my-plugin/preload
```

### Step 2: Create Manifest

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

### Step 3: Define Plugin Class

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

  extensions: PluginExtensionPoints = {
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

### Step 4: Register Commands

```typescript
// plugins/my-plugin/renderer/commands.ts
import { PluginCommandRegistry } from '../../core/PluginCommandRegistry';
import { logger } from '../../../src/renderer/services/logger';

export function registerMyPluginCommands(): void {
  PluginCommandRegistry.register('my-plugin:my-command', async (context) => {
    logger.info('My command executed!', 'My Plugin');
  });
}
```

### Step 5: Build Plugin

Add plugin to vite.main.config.ts:

```typescript
build: {
  lib: {
    entry: {
      main: 'src/main/main.ts',
      'pluginWorker.worker': 'plugins/core/main/pluginWorker/pluginWorker.worker.ts',
      'plugins/my-plugin': 'plugins/my-plugin/main/MyPlugin.ts',
    },
    formats: ['cjs'],
  },
}
```

### Step 6: Register Plugin

```typescript
// plugins/core/initializePlugins.ts
import { PluginManager } from './PluginManager';
import { PluginRegistry } from './PluginRegistry';
import { registerMyPluginCommands } from '../my-plugin/renderer/commands';

export async function initializeBuiltinPlugins(): Promise<void> {
  await PluginManager.start();

  // Register commands in renderer
  registerMyPluginCommands();

  // Load plugin with lazy loading (code loads on first use)
  const myPlugin = await PluginManager.registerPlugin({
    name: 'my-plugin',
    pluginPath: '.vite/build/plugins/my-plugin.cjs',
    manifestPath: 'plugins/my-plugin/manifest.json',
  });

  await PluginRegistry.register(myPlugin);
}
```

**Note:** Plugin code is lazy-loaded on first use. Only the manifest is read during registration for fast startup.

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

**Note:** Plugins should use the typed methods from `PluginContext` (see PluginContext API section above) rather than calling IPC handlers directly. This section documents how to add new APIs to PluginContext if needed.

### Main Process Handler

Plugin IPC handlers must be registered with **both** `ipcMain` (for renderer access) and `pluginIPCBridge` (for plugin worker thread access):

```typescript
// plugins/my-plugin/main/myPluginIpcHandlers.ts
import { ipcMain } from 'electron';
import { pluginIPCBridge } from '../../core/main/PluginIPCBridge';

export function registerMyPluginIpcHandlers(): void {
  // Define handler once (use rest parameters for pluginIPCBridge compatibility)
  const doSomethingHandler = async (_: unknown, ...args: unknown[]) => {
    const arg = args[0] as string;
    // Main process logic
    return { success: true };
  };

  // Register with ipcMain for renderer process
  ipcMain.handle('my-plugin:do-something', doSomethingHandler);

  // Register with pluginIPCBridge for plugin worker threads
  pluginIPCBridge.registerHandler('my-plugin:do-something', doSomethingHandler);
}
```

**Why PluginIPCBridge?**
- **No private API access**: Doesn't rely on Electron's internal `_invokeHandlers` (fragile, could break on upgrades)
- **Type-safe**: Explicit handler registry with proper TypeScript types
- **Security**: Only explicitly registered handlers are accessible to plugins
- **Control**: Can add middleware, validation, rate limiting, etc.

### Preload Script

Add to plugins/preload/pluginPreload.ts:

```typescript
import { myPluginPreloadAPI } from '../my-plugin/preload/myPluginPreload';

export const pluginPreloadAPI = {
  // ... other plugins
  ...myPluginPreloadAPI,
};
```

```typescript
// plugins/my-plugin/preload/myPluginPreload.ts
import { ipcRenderer } from 'electron';

export const myPluginPreloadAPI = {
  myPluginDoSomething: (arg: string) =>
    ipcRenderer.invoke('my-plugin:do-something', arg),
};
```

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

### Command Usage (Renderer)

Commands run in renderer and can use window.electron:

```typescript
PluginCommandRegistry.register('my-plugin:my-command', async (context) => {
  const result = await window.electron.myPluginDoSomething('hello');
  logger.info(`Result: ${result.success}`, 'My Plugin');
});
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

    const items = plugin.extensions.provideNodeContextMenuItems?.(node, context);

    expect(items).toHaveLength(1);
    expect(items?.[0].id).toBe('my-plugin:my-command');
  });

  it('should show indicator for special nodes', () => {
    const plugin = new MyPlugin();
    const node = createMockNode({ customData: { aiContext: true } });

    const indicator = plugin.extensions.provideNodeIndicator?.(node);

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

See `plugins/claude-code/` for a complete working example that:
- Runs in isolated worker thread
- Uses pluginAPI.invokeIPC() to communicate with main process
- Adds context menu items for sending nodes to Claude Code
- Shows AI indicators on nodes with AI context
- Registers multiple commands in renderer

Key files:
- `plugins/claude-code/manifest.json` - Plugin metadata (lazy loading)
- `plugins/claude-code/main/ClaudeCodePlugin.ts` - Plugin (runs in worker)
- `plugins/claude-code/renderer/claudeCodeCommands.ts` - Command registration (renderer)
- `plugins/claude-code/main/claudeCodeIpcHandlers.ts` - Main process handlers
- `plugins/claude-code/preload/claudeCodePreload.ts` - IPC bridge

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
