import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  plugins: [react()],
  resolve: {},
  server: {
    watch: {
      ignored: ['**/coverage/**'],
    },
  },
}));