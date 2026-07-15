import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, '../../../../assets/energy-credits'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/entry/energy-credits-entry.tsx'),
      name: 'EnergyCreditsReactApp',
      formats: ['es'],
      fileName: 'energy-credits-react',
    },
    rollupOptions: {
      external: [],
    },
  },
});
