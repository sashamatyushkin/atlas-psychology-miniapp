import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' — сборка работает из любой подпапки (GitHub Pages, S3, Nginx) без перенастройки.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
