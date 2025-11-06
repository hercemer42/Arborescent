import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/renderer/test/setup.ts',
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/renderer/test/unit/**/*.{test,spec}.{ts,tsx}',
      'src/renderer/test/integration/**/*.{test,spec}.{ts,tsx}',
      'plugins/**/renderer/**/*.{test,spec}.{ts,tsx}',
      'plugins/**/main/**/*.{test,spec}.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.vite/**',
        'out/**',
        'dist/**',
        'src/renderer/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.{ts,tsx}',
        '**/mockData',
        '**/types/**',
        '**/index.ts',      // Barrel exports (re-exports only)
        'src/main/**',      // Electron main process (requires different testing approach)
        'src/preload/**',   // Preload scripts (requires Electron testing)
        'src/renderer/renderer.tsx',  // Entry point
        'src/renderer/data/**',       // Sample data/templates
      ],
      // Coverage thresholds
      // 70% threshold (2025 industry standard for production apps)
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@platform': path.resolve(__dirname, './src/platforms'),
    },
  },
});
