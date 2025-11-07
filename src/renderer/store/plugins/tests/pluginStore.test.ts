import { describe, it, expect, beforeEach, vi } from 'vitest';

// Unmock the pluginStore for this test file (it's globally mocked in setup.ts)
vi.unmock('../pluginStore');

import { usePluginStore } from '../pluginStore';
import { Plugin } from '../../../../shared/types';

describe('pluginStore', () => {
  // Mock console.warn
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    // Reset store state before each test
    usePluginStore.setState({
      plugins: [],
      enabledPlugins: [],
    });
    consoleWarnSpy.mockClear();
  });

  const createMockPlugin = (name: string, enabled = true): Plugin => ({
    manifest: {
      name,
      version: '1.0.0',
      displayName: `${name} Plugin`,
      description: 'Test plugin',
      enabled,
      builtin: false,
      apiVersion: '1.0.0',
    },
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    extensionPoints: {},
  });

  describe('registerPlugin', () => {
    it('should register a new enabled plugin', () => {
      const plugin = createMockPlugin('test-plugin', true);
      const { registerPlugin } = usePluginStore.getState();

      registerPlugin(plugin);

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(1);
      expect(state.plugins[0]).toBe(plugin);
      expect(state.enabledPlugins).toHaveLength(1);
      expect(state.enabledPlugins[0]).toBe(plugin);
    });

    it('should register a new disabled plugin', () => {
      const plugin = createMockPlugin('test-plugin', false);
      const { registerPlugin } = usePluginStore.getState();

      registerPlugin(plugin);

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(1);
      expect(state.plugins[0]).toBe(plugin);
      expect(state.enabledPlugins).toHaveLength(0);
    });

    it('should not register duplicate plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      const { registerPlugin } = usePluginStore.getState();

      registerPlugin(plugin);
      registerPlugin(plugin);

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith('Plugin test-plugin is already registered');
    });

    it('should register multiple different plugins', () => {
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');
      const { registerPlugin } = usePluginStore.getState();

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(2);
      expect(state.enabledPlugins).toHaveLength(2);
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister an existing plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      const { registerPlugin, unregisterPlugin } = usePluginStore.getState();

      registerPlugin(plugin);
      unregisterPlugin('test-plugin');

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(0);
      expect(state.enabledPlugins).toHaveLength(0);
    });

    it('should only remove the specified plugin', () => {
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');
      const { registerPlugin, unregisterPlugin } = usePluginStore.getState();

      registerPlugin(plugin1);
      registerPlugin(plugin2);
      unregisterPlugin('plugin-1');

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(1);
      expect(state.plugins[0].manifest.name).toBe('plugin-2');
    });

    it('should handle unregistering non-existent plugin', () => {
      const { unregisterPlugin } = usePluginStore.getState();

      unregisterPlugin('non-existent');

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(0);
    });
  });

  describe('enablePlugin', () => {
    it('should enable a disabled plugin', () => {
      const plugin = createMockPlugin('test-plugin', false);
      const { registerPlugin, enablePlugin } = usePluginStore.getState();

      registerPlugin(plugin);
      enablePlugin('test-plugin');

      const state = usePluginStore.getState();
      expect(state.enabledPlugins).toHaveLength(1);
      expect(state.enabledPlugins[0].manifest.name).toBe('test-plugin');
      expect(plugin.manifest.enabled).toBe(true);
    });

    it('should not enable an already enabled plugin', () => {
      const plugin = createMockPlugin('test-plugin', true);
      const { registerPlugin, enablePlugin } = usePluginStore.getState();

      registerPlugin(plugin);
      enablePlugin('test-plugin');

      const state = usePluginStore.getState();
      expect(state.enabledPlugins).toHaveLength(1);
    });

    it('should warn when enabling non-existent plugin', () => {
      const { enablePlugin } = usePluginStore.getState();

      enablePlugin('non-existent');

      expect(console.warn).toHaveBeenCalledWith('Plugin non-existent not found');
    });
  });

  describe('disablePlugin', () => {
    it('should disable an enabled plugin', () => {
      const plugin = createMockPlugin('test-plugin', true);
      const { registerPlugin, disablePlugin } = usePluginStore.getState();

      registerPlugin(plugin);
      disablePlugin('test-plugin');

      const state = usePluginStore.getState();
      expect(state.enabledPlugins).toHaveLength(0);
      expect(plugin.manifest.enabled).toBe(false);
    });

    it('should keep plugin in plugins array when disabled', () => {
      const plugin = createMockPlugin('test-plugin', true);
      const { registerPlugin, disablePlugin } = usePluginStore.getState();

      registerPlugin(plugin);
      disablePlugin('test-plugin');

      const state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(1);
      expect(state.plugins[0]).toBe(plugin);
    });

    it('should warn when disabling non-existent plugin', () => {
      const { disablePlugin } = usePluginStore.getState();

      disablePlugin('non-existent');

      expect(console.warn).toHaveBeenCalledWith('Plugin non-existent not found');
    });

    it('should only disable the specified plugin', () => {
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');
      const { registerPlugin, disablePlugin } = usePluginStore.getState();

      registerPlugin(plugin1);
      registerPlugin(plugin2);
      disablePlugin('plugin-1');

      const state = usePluginStore.getState();
      expect(state.enabledPlugins).toHaveLength(1);
      expect(state.enabledPlugins[0].manifest.name).toBe('plugin-2');
    });
  });

  describe('state management', () => {
    it('should maintain correct state across multiple operations', () => {
      const plugin1 = createMockPlugin('plugin-1', true);
      const plugin2 = createMockPlugin('plugin-2', false);
      const plugin3 = createMockPlugin('plugin-3', true);
      const { registerPlugin, enablePlugin, disablePlugin, unregisterPlugin } = usePluginStore.getState();

      // Register all plugins
      registerPlugin(plugin1);
      registerPlugin(plugin2);
      registerPlugin(plugin3);

      let state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(3);
      expect(state.enabledPlugins).toHaveLength(2);

      // Enable plugin-2
      enablePlugin('plugin-2');
      state = usePluginStore.getState();
      expect(state.enabledPlugins).toHaveLength(3);

      // Disable plugin-1
      disablePlugin('plugin-1');
      state = usePluginStore.getState();
      expect(state.enabledPlugins).toHaveLength(2);

      // Unregister plugin-3
      unregisterPlugin('plugin-3');
      state = usePluginStore.getState();
      expect(state.plugins).toHaveLength(2);
      expect(state.enabledPlugins).toHaveLength(1);
    });
  });
});
