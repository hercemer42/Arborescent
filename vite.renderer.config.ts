import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@platform': path.resolve(__dirname, 'src/platforms'),
    },
  },
  server: {
    watch: {
      ignored: ['**/coverage/**'],
    },
  },
}));