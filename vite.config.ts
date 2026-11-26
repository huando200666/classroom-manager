import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => ({
  base: mode === 'web' ? '/classroom-manager/' : './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: mode === 'web' ? 'dist/site' : 'dist/extension',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1400,
  },
}));
