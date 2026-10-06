import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Port tetap per app (Web Admin 5173, lainnya lihat README) supaya bisa jalan bersamaan
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});