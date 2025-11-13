import { defineConfig, Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const pluginsDir = 'plugins';
const pluginEntries: Record<string, string> = {};

const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
	.filter(dirent => dirent.isDirectory() && dirent.name !== 'core')
	.map(dirent => dirent.name);

for (const pluginName of pluginDirs) {
	const configPath = path.join(pluginsDir, pluginName, 'plugin.config.ts');
	if (fs.existsSync(configPath)) {
		const entryFile = path.join(pluginsDir, pluginName, 'main', 'Plugin.ts');

		pluginEntries[`plugins/${pluginName}`] = entryFile;
	}
}

// Vite plugin to copy plugin manifests to build output
function copyPluginManifests(): Plugin {
	return {
		name: 'copy-plugin-manifests',
		closeBundle() {
			// Copy manifest.json files to .vite/build/plugins/
			for (const pluginName of pluginDirs) {
				const manifestPath = path.join(pluginsDir, pluginName, 'renderer', 'manifest.json');
				if (fs.existsSync(manifestPath)) {
					const destPath = path.join('.vite', 'build', 'plugins', `${pluginName}-manifest.json`);
					fs.copyFileSync(manifestPath, destPath);
					console.log(`Copied ${manifestPath} to ${destPath}`);
				}
			}
		}
	};
}

export default defineConfig({
	plugins: [copyPluginManifests()],
	build: {
		lib: {
			entry: {
				main: 'src/main/main.ts',
				'worker': 'plugins/core/worker/worker.ts',
				...pluginEntries,
			},
			formats: ['cjs'],
		},
		rollupOptions: {
			external: ['node-pty', 'electron'],
			output: {
				entryFileNames: (chunkInfo) => {
					if (chunkInfo.name === 'main') {
						return 'main.cjs';
					}
					if (chunkInfo.name.startsWith('plugins/')) {
						return `${chunkInfo.name}.cjs`;
					}
					return '[name].cjs';
				},
				chunkFileNames: '[name]-[hash].cjs',
				format: 'cjs',
				exports: 'named',
			},
		},
		outDir: '.vite/build',
		emptyOutDir: false,
	},
});
