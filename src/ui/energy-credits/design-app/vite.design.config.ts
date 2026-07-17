import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command }) => {
  const shared = {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
  };

  if (command === 'serve') {
    return {
      ...shared,
      root: __dirname,
      server: {
        open: '/preview/',
      },
    };
  }

  return {
    ...shared,
    root: __dirname,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: path.resolve(__dirname, '../../../../assets/energy-credits-design'),
      emptyOutDir: true,
      lib: {
        entry: path.resolve(__dirname, 'src/mountDesignApp.tsx'),
        name: 'EnergyCreditsDesignApp',
        formats: ['es'],
        fileName: 'energy-credits-design',
      },
    },
  };
});
