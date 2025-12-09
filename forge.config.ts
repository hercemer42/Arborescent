import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: false, // Disable asar to allow native modules to load properly
    prune: false, // Don't prune node_modules - we have external dependencies like node-pty
    executableName: 'arborescent', // Keep executable lowercase for Linux compatibility
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async () => {
      // After packaging, copy node-pty to the app directory
      const appPath = join(process.cwd(), 'out', 'Arborescent-linux-x64', 'resources', 'app');
      const nodePtySource = join(process.cwd(), 'node_modules', 'node-pty');
      const nodePtyDest = join(appPath, 'node_modules', 'node-pty');

      if (existsSync(appPath) && existsSync(nodePtySource)) {
        console.log('Copying node-pty to packaged app...');
        cpSync(nodePtySource, nodePtyDest, { recursive: true });
        console.log('node-pty copied successfully');
      }
    },
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    // new MakerRpm({}), // Disabled - requires rpmbuild
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false, // Allow loading native modules from outside asar
    }),
  ],
};

export default config;
