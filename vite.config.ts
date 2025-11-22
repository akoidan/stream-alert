import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'node18',
    lib: {
      entry: resolve(__dirname, 'src/main-vite.ts'),
      formats: ['cjs'],
      fileName: 'bundle'
    },
    rollupOptions: {
      external: [
        // Node built-ins
        'node:process',
        'node:fs',
        'node:path',
        'fs',
        'path', 
        'child_process',
        'os',
        'crypto',
        'http',
        'https',
        'url',
        'util',
        'events',
        'stream',
        'buffer',
        'module',
        'readline',
        // Native addons
        'bindings',
        'native.node',
        // NestJS specific externals that may cause issues
        '@nestjs/core',
        '@nestjs/common',
        '@nestjs/platform-express',
        '@nestjs/config',
        'reflect-metadata',
        'rxjs',
        'telegraf',
        'cli-color',
        'node-ts-config'
      ],
      output: {
        dir: 'dist-vite',
        entryFileNames: 'bundle.js',
        chunkFileNames: 'chunks/[name].js',
        format: 'cjs',
        interop: 'default'
      }
    },
    minify: false,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
