import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
	build: {
		lib: {
			entry: 'src/main/main.ts',
			formats: ['cjs'],
			fileName: () => 'main.cjs',
		},
		rollupOptions: {
			output: {
				entryFileNames: 'main.cjs',
				format: 'cjs',
			},
		},
		outDir: '.vite/build',
		emptyOutDir: false,
	},
});
