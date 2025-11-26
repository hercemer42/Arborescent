import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
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
});