import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: __dirname,
  build: {
    lib: {
      entry: path.resolve(__dirname, 'bootstrap/standaloneProviderBootstrap.ts'),
      name: 'ESAProviderBootstrap',
      formats: ['iife'],
      fileName: () => 'provider-bootstrap.js',
    },
    outDir: path.resolve(__dirname, '../../../../assets/energy-credits-runtime'),
    emptyOutDir: false,
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    minify: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
});
