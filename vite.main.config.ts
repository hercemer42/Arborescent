import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
	build: {
		lib: {
			entry: {
				main: 'src/main/main.ts',
				'pluginWorker.worker': 'plugins/core/main/pluginWorker/pluginWorker.worker.ts',
				'plugins/claude-code': 'plugins/claude-code/main/ClaudeCodePlugin.ts',
			},
			formats: ['cjs'],
		},
		rollupOptions: {
			output: {
				entryFileNames: (chunkInfo) => {
					if (chunkInfo.name === 'main') {
						return 'main.cjs';
					}
					if (chunkInfo.name === 'plugins/claude-code') {
						return 'plugins/claude-code.cjs';
					}
					return '[name].cjs';
				},
				chunkFileNames: '[name]-[hash].cjs',
				format: 'cjs',
			},
		},
		outDir: '.vite/build',
		emptyOutDir: false,
	},
});
