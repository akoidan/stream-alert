import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/main.ts')
    },
    output: {
      entryFileNames: '[name].mjs',
      chunkFileNames: '[name].mjs',
      assetFileNames: '[name].[ext]',
      format: 'es'
    },
    minify: false,
    sourcemap: false,
    ssr: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
