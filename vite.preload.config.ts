import { defineConfig } from 'vite';

// Intentionally empty: Electron Forge's VitePlugin supplies preload-
// specific defaults (entry, cjs format, electron as external, output
// name index.js) when target='preload' in forge.config.ts. Writing an
// explicit lib config here would duplicate those defaults and could
// drift from Forge's preferred preload output shape on upgrade.
//
// If a project-specific preload option is ever needed (extra external,
// define, alias), add it as an override here — do not redefine the
// baseline. See vite.main.config.ts for the explicit main-process
// config pattern.
export default defineConfig({});
