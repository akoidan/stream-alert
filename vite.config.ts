import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { copyFileSync, cpSync } from 'fs';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      formats: ['cjs'],
      fileName: 'main'
    },
    rollupOptions: {
      plugins: [
        {
          name: 'copy-required-dependencies',
          generateBundle(options, bundle) {
            const copiedModules = new Set<string>();
            const nodeModulesDir = resolve(__dirname, 'node_modules');
            const distNodeModulesDir = resolve(__dirname, 'dist', 'node_modules');
            
            // Ensure dist/node_modules exists
            if (!existsSync(distNodeModulesDir)) {
              mkdirSync(distNodeModulesDir, { recursive: true });
            }
            
            // Function to copy a module (but not its dependencies)
            function copyModule(moduleName: string) {
              if (copiedModules.has(moduleName)) return;
              copiedModules.add(moduleName);
              
              try {
                const moduleDir = join(nodeModulesDir, moduleName);
                if (!existsSync(moduleDir)) return;
                
                const distModuleDir = join(distNodeModulesDir, moduleName);
                
                // Copy the entire module directory
                cpSync(moduleDir, distModuleDir, { recursive: true });
                console.log(`Copied module: ${moduleName}`);
              } catch (error) {
                console.warn(`Warning: Could not copy module ${moduleName}:`, error);
              }
            }
            
            // Get all imported modules from Rollup's module info
            const moduleIds = this.getModuleIds();
            moduleIds.forEach(moduleId => {
              // Skip relative imports and built-in modules
              if (typeof moduleId === 'string' && 
                  !moduleId.startsWith('./') && 
                  !moduleId.startsWith('../') && 
                  !moduleId.startsWith('\0') &&
                  !moduleId.startsWith('node:') &&
                  !['fs', 'path', 'process', 'http', 'https', 'url', 'util', 'stream',
                    'crypto', 'zlib', 'net', 'tls', 'dns', 'async_hooks', 'querystring',
                    'events', 'buffer', 'child_process', 'cluster', 'dgram', 'inspector',
                    'module', 'os', 'perf_hooks', 'readline', 'repl', 'string_decoder',
                    'timers', 'trace_events', 'tty', 'v8', 'vm', 'wasi', 'worker_threads'].includes(moduleId)) {
                
                // Extract module name from path (remove subpaths)
                const moduleName = moduleId.split('/')[0];
                if (moduleName) {
                  copyModule(moduleName);
                }
              }
            });
          }
        }
      ]
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
