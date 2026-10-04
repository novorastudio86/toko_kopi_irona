import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Port tetap per app (Web Customer 5174, lainnya lihat README) supaya bisa jalan bersamaan
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
