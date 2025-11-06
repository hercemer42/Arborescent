import { defineConfig } from 'vite';
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
		const entryFile = path.join(pluginsDir, pluginName, 'main', `${pluginName.split('-').map(word =>
			word.charAt(0).toUpperCase() + word.slice(1)
		).join('')}Plugin.ts`);

		pluginEntries[`plugins/${pluginName}`] = entryFile;
	}
}

export default defineConfig({
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
				exports: 'auto',
			},
		},
		outDir: '.vite/build',
		emptyOutDir: false,
	},
});
