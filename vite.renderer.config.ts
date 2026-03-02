import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/coverage/**'],
    },
  },
}));