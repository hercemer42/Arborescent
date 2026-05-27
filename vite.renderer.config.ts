import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    // Read at build time. `ARBO_DIAGNOSTICS=1 npm run make` bakes the
    // registry-drift check into a production dogfood build; a plain build
    // leaves it off. See DIAGNOSTICS_ON in treeStore.ts.
    'process.env.ARBO_DIAGNOSTICS': JSON.stringify(process.env.ARBO_DIAGNOSTICS ?? ''),
  },
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/coverage/**'],
    },
  },
}));