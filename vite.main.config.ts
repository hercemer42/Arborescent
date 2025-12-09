import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		lib: {
			entry: {
				main: 'src/main/main.ts',
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
