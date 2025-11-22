import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Plugin to copy assets after build
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    writeBundle() {
      console.log('Copying assets after Vite build...');
      
      // Create proper directory structure for native bindings
      if (!fs.existsSync('dist/build/Debug')) {
        fs.mkdirSync('dist/build/Debug', { recursive: true });
      }

      // Copy native.node to dist/build/Debug (where bindings expects it)
      if (fs.existsSync('build/Debug/native.node')) {
        fs.copyFileSync('build/Debug/native.node', 'dist/build/Debug/native.node');
        console.log('Copied native.node to dist/build/Debug');
      } else {
        console.error('native.node not found in build/Debug directory');
        process.exit(1);
      }

      // Copy config files
      if (!fs.existsSync('dist/config')) {
        fs.mkdirSync('dist/config', { recursive: true });
      }
      fs.copyFileSync('src/config/default.json', 'dist/config/default.json');
      console.log('Copied config files');

      // Copy only production dependencies from node_modules
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});

      if (!fs.existsSync('dist/node_modules')) {
        fs.mkdirSync('dist/node_modules', { recursive: true });
      }

      dependencies.forEach(dep => {
        const src = `node_modules/${dep}`;
        const dest = `dist/node_modules/${dep}`;
        
        if (fs.existsSync(src)) {
          execSync(`xcopy "${src}" "${dest}" /E /I /H /Y`, { stdio: 'inherit' });
          console.log(`Copied ${dep}`);
        } else {
          console.warn(`${dep} not found in node_modules`);
        }
      });

      console.log('Vite build completed with dependencies');
    }
  };
}

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
        dir: 'dist',
        entryFileNames: 'bundle.js',
        chunkFileNames: 'chunks/[name].js',
        format: 'cjs',
        interop: 'esModule'
      }
    },
    minify: false,
    sourcemap: true
  },
  plugins: [
    copyAssetsPlugin()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
